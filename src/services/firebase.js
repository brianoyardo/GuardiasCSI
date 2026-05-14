import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAes98Y-p_8M6lcRxoaPbC87GPLYkYKKBA",
  authDomain: "guardias-prueba.firebaseapp.com",
  projectId: "guardias-prueba",
  storageBucket: "guardias-prueba.firebasestorage.app",
  messagingSenderId: "693842246915",
  appId: "1:693842246915:web:5e7eb2f598dc7031397d36"
};

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export default app