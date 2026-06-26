import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let cachedDb: Firestore | null | undefined;

function app(): App | null {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  try {
    if (projectId && clientEmail && privateKey) {
      return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return initializeApp(projectId ? { projectId } : undefined);
    }
  } catch (error) {
    console.warn("Firebase Admin kunne ikke initialiseres", error);
  }
  return null;
}

export function getAdminDb(): Firestore | null {
  if (cachedDb !== undefined) return cachedDb;
  const firebaseApp = app();
  cachedDb = firebaseApp ? getFirestore(firebaseApp) : null;
  return cachedDb;
}
