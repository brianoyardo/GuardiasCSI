/**
 * SentinelOps — User Cleanup Script (Fase 12.7)
 * 
 * Removes all users from Firestore collection 'users' EXCEPT the admin.
 * Does NOT touch Firebase Auth accounts (that would require firebase-admin SDK).
 * 
 * Usage: yarn cleanup:users <admin_password>
 */

import { initializeApp } from 'firebase/app'
import {
  getFirestore, doc, collection, getDocs, deleteDoc
} from 'firebase/firestore'
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

const ADMIN_EMAIL = 'manchas@gmail.com'
const ADMIN_PASSWORD = process.argv[2] || ''

if (!ADMIN_PASSWORD) {
  console.error('❌ Uso: yarn cleanup:users <password>')
  process.exit(1)
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  SentinelOps — User Cleanup (Fase 12.7)')
  console.log('═══════════════════════════════════════════════════')

  // Authenticate as admin
  const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD)
  console.log(`  ✅ Autenticado como admin (${cred.user.uid})`)

  // Fetch all users
  const snap = await getDocs(collection(db, 'users'))
  const toDelete = []

  for (const d of snap.docs) {
    const data = d.data()
    // Keep the admin account
    if (data.email === ADMIN_EMAIL) {
      console.log(`  🔒 Protegido: ${data.email} (${d.id})`)
      continue
    }
    toDelete.push({ id: d.id, email: data.email, role: data.role })
  }

  if (toDelete.length === 0) {
    console.log('\n  ✅ No hay usuarios duplicados que eliminar.')
    process.exit(0)
  }

  console.log(`\n  🗑 ${toDelete.length} usuarios marcados para eliminación:`)
  toDelete.forEach(u => console.log(`     - ${u.email} (${u.role}) [${u.id}]`))

  // Delete them
  let deleted = 0
  for (const u of toDelete) {
    await deleteDoc(doc(db, 'users', u.id))
    deleted++
  }

  console.log(`\n  ✅ ${deleted} usuarios eliminados de Firestore.`)
  console.log('  ⚠️  NOTA: Los accounts de Firebase Auth NO fueron eliminados.')
  console.log('     Para limpiar Auth, usa la Firebase Console → Authentication → Users.')
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  🧹 CLEANUP COMPLETADO')
  console.log('═══════════════════════════════════════════════════')
  process.exit(0)
}

main().catch(err => {
  console.error('\n❌ Error:', err)
  process.exit(1)
})
