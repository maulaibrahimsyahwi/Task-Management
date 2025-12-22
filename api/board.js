import { db, auth } from "./config.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split("Bearer ")[1];
  let uid;

  try {
    const decodedToken = await auth.verifyIdToken(token);
    uid = decodedToken.uid;
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }

  const { boardId } = req.query;

  if (!boardId) {
    return res.status(400).json({ error: "Missing boardId" });
  }

  try {
    const boardRef = db.collection("boards").doc(boardId);
    const boardSnap = await boardRef.get();

    if (!boardSnap.exists) {
      return res.status(404).json({ error: "Board not found" });
    }

    const boardData = boardSnap.data();
    const isOwner = boardData.createdBy === uid;

    let hasAccess = isOwner;

    if (!hasAccess) {
      const memberId = `${boardId}_${uid}`;
      const memberSnap = await db
        .collection("boardMembers")
        .doc(memberId)
        .get();
      if (memberSnap.exists) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res
        .status(403)
        .json({ error: "Forbidden: You do not have access to this board" });
    }

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
