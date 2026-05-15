import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

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

async function test() {
  try {
    console.log("Testing [[1,2], [3,4]]...")
    await setDoc(doc(db, 'test/nestedArray1'), {
      coords: [[1, 2], [3, 4]]
    })
    console.log("Success 1!")
  } catch (e) {
    console.error("Fail 1:", e.message)
  }

  try {
    console.log("Testing [{lng: 1, lat: 2}]...")
    await setDoc(doc(db, 'test/nestedArray2'), {
      coords: [{lng: 1, lat: 2}, {lng: 3, lat: 4}]
    })
    console.log("Success 2!")
  } catch (e) {
    console.error("Fail 2:", e.message)
  }

  process.exit(0)
}
test()
