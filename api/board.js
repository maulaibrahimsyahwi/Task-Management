import { db, auth } from "./config.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- SECURITY CHECK START ---
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    // Verifikasi apakah token valid (User benar-benar login)
    await auth.verifyIdToken(token);
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
  // --- SECURITY CHECK END ---

  const { boardId } = req.query;

  if (!boardId) {
    return res.status(400).json({ error: "Missing boardId" });
  }

  try {
    const columnsRef = db.collection("columns");
    const tasksRef = db.collection("tasks");

    const [colSnap, taskSnap] = await Promise.all([
      columnsRef.where("boardId", "==", boardId).get(),
      tasksRef.where("boardId", "==", boardId).get(),
    ]);

    const columns = colSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const tasks = taskSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json({ columns, tasks });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
