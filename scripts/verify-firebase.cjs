/* eslint-env node */
// Run intentionally with: node scripts/verify-firebase.cjs --live
// Uses three test-only accounts on the configured Firebase project, no admin key.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const babel = require('@babel/core');
if (!process.argv.includes('--live')) {
  console.error(
    'Use --live to create/reuse test accounts and verify the configured Firebase backend.',
  );
  process.exit(1);
}
const root = path.resolve(__dirname, '..');
const cache = path.join(root, '.cache', 'verification');
fs.mkdirSync(cache, { recursive: true });
const output = path.join(root, '.cache', 'live-services');
fs.mkdirSync(output, { recursive: true });
for (const name of [
  'firebaseConfig',
  'firebase',
  'authService',
  'chatModel',
  'chatService',
  'presenceService',
]) {
  const result = babel.transformFileSync(
    path.join(root, 'src', 'services', name + '.ts'),
    {
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    },
  );
  fs.writeFileSync(path.join(output, name + '.js'), result.code);
}
const { initializeApp, deleteApp } = require('firebase/app');
const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
} = require('firebase/auth');
const {
  getDatabase,
  ref,
  set,
  get,
  push,
  onValue,
  onDisconnect,
  serverTimestamp,
  goOffline,
} = require('firebase/database');
const { firebaseConfig } = require(path.join(output, 'firebaseConfig.js'));
const { getFirebase } = require(path.join(output, 'firebase.js'));
const service = require(path.join(output, 'chatService.js'));
const authService = require(path.join(output, 'authService.js'));
const { unreadCount, sortedMessages } = require(path.join(
  output,
  'chatModel.js',
));
const { batTrangThaiOnline } = require(path.join(output, 'presenceService.js'));
const accountsFile = path.join(cache, 'firebase-test-accounts.json');
const accounts = fs.existsSync(accountsFile)
  ? JSON.parse(fs.readFileSync(accountsFile, 'utf8'))
  : {};
const apps = [];
const stops = [];
const checks = [];
const ok = label => {
  checks.push(label);
  console.log('PASS ' + label);
};
const waitFor = (target, predicate, label) =>
  new Promise((resolve, reject) => {
    let unsubscribe;
    const timer = setTimeout(() => {
      unsubscribe?.();
      reject(new Error('Timeout: ' + label));
    }, 20000);
    unsubscribe = onValue(
      target,
      snapshot => {
        if (predicate(snapshot.val())) {
          clearTimeout(timer);
          unsubscribe?.();
          resolve(snapshot.val());
        }
      },
      error => {
        clearTimeout(timer);
        unsubscribe?.();
        reject(error);
      },
    );
    stops.push(() => {
      clearTimeout(timer);
      unsubscribe?.();
    });
  });
async function account(label, auth, database) {
  if (!accounts[label]) {
    accounts[label] = {
      email:
        'udu-test-' + label.toLowerCase() + '-' + Date.now() + '@example.com',
      password: crypto.randomBytes(18).toString('base64url'),
    };
    fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2));
    const result = await createUserWithEmailAndPassword(
      auth,
      accounts[label].email,
      accounts[label].password,
    );
    await updateProfile(result.user, { displayName: 'Kiem thu ' + label });
  } else {
    await signInWithEmailAndPassword(
      auth,
      accounts[label].email,
      accounts[label].password,
    );
  }
  const uid = auth.currentUser.uid;
  accounts[label].uid = uid;
  fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2));
  await set(ref(database, 'users/' + uid), { name: 'Kiểm thử ' + label });
  return uid;
}
async function main() {
  const first = getFirebase();
  apps.push(first.auth.app);
  const secondApp = initializeApp(firebaseConfig, 'udu-check-B');
  apps.push(secondApp);
  const second = { auth: getAuth(secondApp), database: getDatabase(secondApp) };
  const thirdApp = initializeApp(firebaseConfig, 'udu-check-C');
  apps.push(thirdApp);
  const third = { auth: getAuth(thirdApp), database: getDatabase(thirdApp) };
  const anonymousApp = initializeApp(firebaseConfig, 'udu-check-anon');
  apps.push(anonymousApp);
  const uidA = await account('A', first.auth, first.database);
  const uidB = await account('B', second.auth, second.database);
  const uidC = await account('C', third.auth, third.database);
  assert(uidA !== uidB && uidB !== uidC);
  ok('Register three real Firebase Email/Password users with profiles');
  const id = await service.moCuocTroChuyen(uidA, uidB);
  assert.equal(
    (await get(ref(second.database, 'userChats/' + uidB + '/' + id))).val(),
    uidA,
  );
  ok('Both users receive the same private conversation index');
  let received;
  const stopChats = service.langNgheCuocTroChuyen(
    uidA,
    value => {
      received = value;
    },
    error => {
      throw error;
    },
  );
  stops.push(stopChats);
  const text = 'Realtime ' + Date.now();
  const delivery = waitFor(
    ref(second.database, 'chats/' + id),
    value =>
      value &&
      Object.values(value.messages || {}).some(
        message => message.text === text,
      ),
    'A to B delivery',
  );
  await service.guiTinFirebase(id, uidA, text);
  await delivery;
  ok('A sends through app service; B receives via onValue without reload');
  await set(push(ref(second.database, 'chats/' + id + '/messages')), {
    senderId: uidB,
    text: 'Reply ' + Date.now(),
    type: 'text',
    createdAt: serverTimestamp(),
  });
  const room = await waitFor(
    ref(first.database, 'chats/' + id),
    value => value && unreadCount(value, uidA) > 0,
    'B to A unread',
  );
  const last = sortedMessages(room).at(-1)[0];
  await service.danhDauDaDoc(id, uidA, last);
  const readRoom = (await get(ref(first.database, 'chats/' + id))).val();
  assert.equal(unreadCount(readRoom, uidA), 0);
  ok('B to A realtime unread count increases and read marker resets it');
  await service.guiTinFirebase(id, uidA, '', {
    latitude: 10.762,
    longitude: 106.66,
  });
  const locationRoom = (await get(ref(second.database, 'chats/' + id))).val();
  assert(
    Object.values(locationRoom.messages).some(
      message =>
        message.type === 'location' &&
        message.latitude === 10.762 &&
        message.longitude === 106.66,
    ),
  );
  ok(
    'Location message stores the exact test coordinates (not device location)',
  );
  console.log('CHECK client blank message');
  await assert.rejects(service.guiTinFirebase(id, uidA, '   '));
  console.log('CHECK server blank message');
  await assert.rejects(
    set(push(ref(first.database, 'chats/' + id + '/messages')), {
      senderId: uidA,
      text: '   ',
      type: 'text',
      createdAt: serverTimestamp(),
    }),
  );
  console.log('CHECK sender spoofing');
  await assert.rejects(
    set(push(ref(first.database, 'chats/' + id + '/messages')), {
      senderId: uidB,
      text: 'spoofed',
      type: 'text',
      createdAt: serverTimestamp(),
    }),
  );
  console.log('CHECK outsider room read');
  await assert.rejects(get(ref(third.database, 'chats/' + id)));
  console.log('CHECK outsider index read');
  await assert.rejects(get(ref(third.database, 'userChats/' + uidA)));
  console.log('CHECK unauthenticated users read');
  await assert.rejects(get(ref(getDatabase(anonymousApp), 'users')));
  ok(
    'Rules deny blank messages, sender spoofing, third-party chat/index reads and unauthenticated contacts',
  );
  const stopPresence = batTrangThaiOnline(uidA, error => {
    throw error;
  });
  await waitFor(
    ref(second.database, 'presence/' + uidA + '/connections'),
    value => value && Object.values(value).some(Boolean),
    'presence online',
  );
  await stopPresence();
  await waitFor(
    ref(second.database, 'presence/' + uidA + '/connections'),
    value => !value,
    'presence cleanup',
  );
  const connection = push(
    ref(second.database, 'presence/' + uidB + '/connections'),
  );
  await onDisconnect(connection).remove();
  await set(connection, true);
  goOffline(second.database);
  await waitFor(
    ref(first.database, 'presence/' + uidB + '/connections'),
    value => !value,
    'disconnect offline',
  );
  ok('Presence goes online, cleans up and onDisconnect removes offline device');
  assert(received && received[id]);
  stopChats();
  await authService.dangXuatFirebase();
  assert.equal(first.auth.currentUser, null);
  await authService.dangNhapFirebase(accounts.A.email, accounts.A.password);
  assert.equal(first.auth.currentUser.uid, uidA);
  await assert.rejects(
    authService.dangNhapFirebase(accounts.A.email, 'invalid-password'),
  );
  ok('Sign out, sign back in and reject incorrect Firebase password');
  await signOut(first.auth);
  fs.writeFileSync(
    path.join(cache, 'firebase-live-result.json'),
    JSON.stringify(
      {
        projectId: firebaseConfig.projectId,
        checks,
        passed: true,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}
main()
  .catch(error => {
    console.error(error.code, error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    stops.forEach(stop => stop());
    const shutdown = setTimeout(
      () => process.exit(process.exitCode || 0),
      3000,
    );
    await Promise.all(
      apps.map(async app => {
        goOffline(getDatabase(app));
        await deleteApp(app);
      }),
    );
    clearTimeout(shutdown);
    process.exit(process.exitCode || 0);
  });
