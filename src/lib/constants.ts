export const ADMIN_CHECKLIST_TASKS = [
  { taskName: "Upload Order PDF & Label PDF", taskType: "upload", forRole: "admin" },
  { taskName: "Notify GM & Pre-Plan Catering", taskType: "notify", forRole: "admin" },
  { taskName: "Assign Driver (if necessary)", taskType: "driver", forRole: "admin" },
  { taskName: "Update Master Catering Sheet", taskType: "sheet", forRole: "admin" },
  { taskName: "Follow Up with Customer", taskType: "followup", forRole: "admin" },
];

export const GM_CHECKLIST_TASKS = [
  { taskName: "Confirm Catering Order", taskType: "confirm", forRole: "gm" },
  { taskName: "Snap Photo of Order Once Completed", taskType: "photo", forRole: "gm" },
];

export const ALL_CHECKLIST_TASKS = [...ADMIN_CHECKLIST_TASKS, ...GM_CHECKLIST_TASKS];
