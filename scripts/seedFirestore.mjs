/**
 * SentinelOps — Firestore Seed Script
 * 
 * Initializes Firestore with roles, admin profile, and base data.
 * MUST authenticate first since Firestore rules require it.
 * 
 * Usage: 
 *   yarn seed <password>
 *   node scripts/seedFirestore.mjs <password>
 * 
 * Example:
 *   yarn seed miContraseña123
 * 
 * Prerequisites:
 *   - Firebase Auth user "manchas@gmail.com" must already exist
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'

// ─── Firebase Config ───
const firebaseConfig = {
  apiKey: "AIzaSyAes98Y-p_8M6lcRxoaPbC87GPLYkYKKBA",
  authDomain: "guardias-prueba.firebaseapp.com",
  projectId: "guardias-prueba",
  storageBucket: "guardias-prueba.firebasestorage.app",
  messagingSenderId: "693842246915",
  appId: "1:693842246915:web:5e7eb2f598dc7031397d36",
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

// ─── CONFIGURATION ───
const ADMIN_EMAIL = 'manchas@gmail.com'
const ADMIN_PASSWORD = process.argv[2] || ''

// ─── Role Definitions ───
const ROLES_SEED = {
  admin: {
    name: 'Administrador',
    description: 'Acceso total al sistema. Gestión de usuarios, rutas, rondas y monitoreo.',
    permissions: ['*'],
    level: 1,
    createdAt: new Date().toISOString(),
  },
  operations_chief: {
    name: 'Jefe de Operaciones',
    description: 'Supervisión operativa. Asignación de rondas, monitoreo y gestión de incidentes.',
    permissions: [
      'dashboard:read', 'users:read', 'guards:read', 'guards:manage',
      'rondas:read', 'rondas:assign', 'rondas:manage',
      'routes:read', 'routes:manage', 'checkpoints:read', 'checkpoints:manage',
      'monitoring:read', 'monitoring:full',
      'incidents:read', 'incidents:manage',
      'maps:full', 'analytics:read', 'attendance:read', 'notifications:send',
    ],
    level: 2,
    createdAt: new Date().toISOString(),
  },
  supervisor: {
    name: 'Supervisor',
    description: 'Monitoreo de rondas activas y revisión de incidencias.',
    permissions: [
      'dashboard:read', 'rondas:read', 'monitoring:read',
      'incidents:read', 'maps:read', 'guards:read',
      'checkpoints:read', 'attendance:read',
    ],
    level: 3,
    createdAt: new Date().toISOString(),
  },
  guard: {
    name: 'Guardia',
    description: 'Ejecución de rondas, registro de checkpoints y reporte de incidentes.',
    permissions: [
      'rondas:own', 'checkpoints:complete',
      'incidents:create', 'attendance:own', 'maps:own',
    ],
    level: 4,
    createdAt: new Date().toISOString(),
  },
}

// ─── Seed Functions ───

async function authenticateAdmin() {
  console.log('\n🔐 Authenticating as admin...')

  if (!ADMIN_PASSWORD) {
    console.error('  ❌ Password required!')
    console.log('')
    console.log('  Usage: yarn seed <password>')
    console.log('  Example: yarn seed miContraseña123')
    console.log('')
    console.log('  The password is for the Firebase Auth user: ' + ADMIN_EMAIL)
    process.exit(1)
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
    console.log(`  ✅ Authenticated as: ${ADMIN_EMAIL}`)
    console.log(`     UID: ${credential.user.uid}`)
    return credential.user
  } catch (error) {
    console.error(`  ❌ Auth failed: ${error.message}`)
    if (error.code === 'auth/user-not-found') {
      console.log(`  💡 Create "${ADMIN_EMAIL}" in Firebase Console → Authentication → Users`)
    } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      console.log(`  💡 Password is incorrect for "${ADMIN_EMAIL}"`)
    }
    process.exit(1)
  }
}

async function seedRoles() {
  console.log('\n📋 Seeding roles collection...')
  
  for (const [roleId, roleData] of Object.entries(ROLES_SEED)) {
    const roleRef = doc(db, 'roles', roleId)
    await setDoc(roleRef, roleData, { merge: true })
    console.log(`  ✅ Role "${roleId}" → ${roleData.name}`)
  }
  
  console.log(`  📋 ${Object.keys(ROLES_SEED).length} roles seeded.`)
}

async function seedAdminProfile(firebaseUser) {
  console.log('\n👤 Creating admin profile in Firestore...')
  
  const uid = firebaseUser.uid
  
  const adminProfile = {
    uid,
    email: ADMIN_EMAIL,
    fullName: 'Administrador SentinelOps',
    phone: '',
    photoURL: '',
    role: 'admin',
    status: 'active',
    clientId: null,
    locationId: null,
    deviceToken: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
  }
  
  const userRef = doc(db, 'users', uid)
  await setDoc(userRef, adminProfile, { merge: true })
  
  console.log(`  ✅ Admin profile created/updated`)
  console.log(`     Email: ${ADMIN_EMAIL}`)
  console.log(`     Role: admin`)
  console.log(`     Status: active`)
  console.log(`     UID: ${uid}`)
  
  // Log activity
  const logRef = doc(db, 'activityLogs', `seed_${Date.now()}`)
  await setDoc(logRef, {
    userId: uid,
    action: 'seed_init',
    module: 'system',
    details: { 
      email: ADMIN_EMAIL, 
      role: 'admin',
      rolesSeeded: Object.keys(ROLES_SEED),
    },
    timestamp: serverTimestamp(),
  })
  console.log('  📝 Activity log created')
}

async function checkState(label) {
  console.log(`\n🔍 ${label}`)
  
  const colNames = ['users', 'roles', 'activityLogs']
  
  for (const col of colNames) {
    try {
      const snapshot = await getDocs(collection(db, col))
      const docs = snapshot.docs.map(d => d.id)
      console.log(`  📂 ${col}: ${snapshot.size} docs ${snapshot.size > 0 ? `[${docs.join(', ')}]` : ''}`)
    } catch (error) {
      console.log(`  📂 ${col}: ⚠ ${error.message}`)
    }
  }
}

// ─── Main ───

async function main() {
  console.log('═══════════════════════════════════════')
  console.log('  SentinelOps — Firestore Seed Script')
  console.log('═══════════════════════════════════════')
  
  // Step 1: Authenticate (required for Firestore writes)
  const adminUser = await authenticateAdmin()
  
  // Step 2: Check current state
  await checkState('Current Firestore state:')
  
  // Step 3: Seed roles
  await seedRoles()
  
  // Step 4: Create admin profile
  await seedAdminProfile(adminUser)
  
  // Step 5: Verify
  await checkState('Final Firestore state:')
  
  console.log('\n═══════════════════════════════════════')
  console.log('  ✅ Seed complete!')
  console.log('  🚀 You can now login at http://localhost:3000')
  console.log('═══════════════════════════════════════')
  
  process.exit(0)
}

main().catch((error) => {
  console.error('\n❌ Seed failed:', error.message)
  process.exit(1)
})
