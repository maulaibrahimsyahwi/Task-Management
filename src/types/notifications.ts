import type { BoardRole } from "./collaboration";

export type ActivityNotification = {
	id: string;
	message: string;
	createdAt: number;
	kind?: "info" | "invite";
	inviteId?: string;
	boardId?: string;
	role?: BoardRole;
	invitedByName?: string;
};
