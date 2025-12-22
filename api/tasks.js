import { db, auth } from "./config.js";

export default async function handler(req, res) {
  const collectionName = "tasks";

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

  try {
    if (req.method === "POST") {
      const payload = req.body;

      if (!payload.boardId || typeof payload.boardId !== "string") {
        return res.status(400).json({ error: "Invalid or missing boardId" });
      }
      if (!payload.title || typeof payload.title !== "string") {
        return res.status(400).json({ error: "Invalid or missing title" });
      }

      const boardRef = db.collection("boards").doc(payload.boardId);
      const boardSnap = await boardRef.get();

      if (!boardSnap.exists) {
        return res.status(404).json({ error: "Board not found" });
      }

      const isOwner = boardSnap.data().createdBy === uid;
      let hasAccess = isOwner;

      if (!hasAccess) {
        const memberId = `${payload.boardId}_${uid}`;
        const memberSnap = await db
          .collection("boardMembers")
          .doc(memberId)
          .get();
        if (memberSnap.exists) hasAccess = true;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }

      const cleanPayload = {
        boardId: payload.boardId,
        title: payload.title,
        description: payload.description || "",
        status: payload.status || "todo",
        priority: payload.priority || "medium",
        columnId: payload.columnId || null,
        createdBy: uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await db.collection(collectionName).add(cleanPayload);
      return res.status(201).json({ id: docRef.id, ...cleanPayload });
    }

    if (req.method === "PUT") {
      const { id, ...updates } = req.body;
      if (!id) return res.status(400).json({ error: "Missing ID" });

      const taskRef = db.collection(collectionName).doc(id);
      const taskSnap = await taskRef.get();

      if (!taskSnap.exists) {
        return res.status(404).json({ error: "Task not found" });
      }

      const taskData = taskSnap.data();
      const boardId = taskData.boardId;

      const boardSnap = await db.collection("boards").doc(boardId).get();
      const isOwner = boardSnap.exists && boardSnap.data().createdBy === uid;

      let hasAccess = isOwner;

      if (!hasAccess) {
        const memberId = `${boardId}_${uid}`;
        const memberSnap = await db
          .collection("boardMembers")
          .doc(memberId)
          .get();
        if (memberSnap.exists) hasAccess = true;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }

      const allowedUpdates = [
        "title",
        "description",
        "status",
        "priority",
        "columnId",
        "assignedTo",
        "dueDate",
      ];

      const cleanUpdates = {};
      Object.keys(updates).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          cleanUpdates[key] = updates[key];
        }
      });

      cleanUpdates.updatedAt = new Date().toISOString();

      await taskRef.update(cleanUpdates);
      return res
        .status(200)
        .json({ success: true, updatedFields: cleanUpdates });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "Missing ID" });

      const taskRef = db.collection(collectionName).doc(id);
      const taskSnap = await taskRef.get();

      if (!taskSnap.exists) {
        return res.status(404).json({ error: "Task not found" });
      }

      const taskData = taskSnap.data();
      const boardId = taskData.boardId;

      const boardSnap = await db.collection("boards").doc(boardId).get();
      const isOwner = boardSnap.exists && boardSnap.data().createdBy === uid;

      let hasAccess = isOwner;

      if (!hasAccess) {
        const memberId = `${boardId}_${uid}`;
        const memberSnap = await db
          .collection("boardMembers")
          .doc(memberId)
          .get();
        if (memberSnap.exists) hasAccess = true;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }

      await taskRef.delete();
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
