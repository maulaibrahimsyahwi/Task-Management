import { db, auth } from "./config.js";

export default async function handler(req, res) {
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
    if (req.method === "GET") {
      const { boardId } = req.query;

      if (!boardId) {
        return res.status(400).json({ error: "Missing boardId" });
      }

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
        if (memberSnap.exists) hasAccess = true;
      }

      if (!hasAccess) {
        return res.status(403).json({ error: "Forbidden: Access denied" });
      }

      const [colSnap, taskSnap] = await Promise.all([
        db.collection("columns").where("boardId", "==", boardId).get(),
        db.collection("tasks").where("boardId", "==", boardId).get(),
      ]);

      const columns = colSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const tasks = taskSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      return res.status(200).json({
        board: { id: boardSnap.id, ...boardData },
        columns,
        tasks,
      });
    }

    if (req.method === "POST") {
      const { name, description, projectId } = req.body;

      if (!name || !projectId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const payload = {
        name: name.trim(),
        description: description ? description.trim() : "",
        projectId,
        createdBy: uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const docRef = await db.collection("boards").add(payload);
      return res.status(201).json({ id: docRef.id, ...payload });
    }

    if (req.method === "PUT") {
      const { id, name, description } = req.body;

      if (!id) return res.status(400).json({ error: "Missing Board ID" });

      const boardRef = db.collection("boards").doc(id);
      const boardSnap = await boardRef.get();

      if (!boardSnap.exists) {
        return res.status(404).json({ error: "Board not found" });
      }

      if (boardSnap.data().createdBy !== uid) {
        return res
          .status(403)
          .json({ error: "Forbidden: Only owner can update" });
      }

      const updates = { updatedAt: Date.now() };
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description.trim();

      await boardRef.update(updates);
      return res.status(200).json({ success: true, updatedFields: updates });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;

      if (!id) return res.status(400).json({ error: "Missing Board ID" });

      const boardRef = db.collection("boards").doc(id);
      const boardSnap = await boardRef.get();

      if (!boardSnap.exists) {
        return res.status(404).json({ error: "Board not found" });
      }

      if (boardSnap.data().createdBy !== uid) {
        return res
          .status(403)
          .json({ error: "Forbidden: Only owner can delete" });
      }

      const batch = db.batch();
      batch.delete(boardRef);

      const tasksSnapshot = await db
        .collection("tasks")
        .where("boardId", "==", id)
        .get();
      tasksSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

      const columnsSnapshot = await db
        .collection("columns")
        .where("boardId", "==", id)
        .get();
      columnsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

      const membersSnapshot = await db
        .collection("boardMembers")
        .where("boardId", "==", id)
        .get();
      membersSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

      await batch.commit();

      return res
        .status(200)
        .json({ success: true, message: "Board and related data deleted" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
