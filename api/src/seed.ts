/** Creates a demo account with sample data: `npm run seed -w api`. */
import bcrypt from "bcryptjs";
import { env } from "./config/env.js";
import { connectDb, disconnectDb } from "./db.js";
import { UserModel } from "./models/user.js";
import { ProjectModel } from "./models/project.js";
import { TaskModel } from "./models/task.js";
import { CommentModel } from "./models/comment.js";

const DEMO_EMAIL = "demo@taskflow.dev";
const DEMO_PASSWORD = "taskflow-demo";

async function main() {
  await connectDb(env.MONGODB_URI);
  const existing = await UserModel.findOne({ email: DEMO_EMAIL });
  if (existing) {
    const projects = await ProjectModel.find({ owner: existing._id }).distinct("_id");
    const tasks = await TaskModel.find({ project: { $in: projects } }).distinct("_id");
    await CommentModel.deleteMany({ task: { $in: tasks } });
    await TaskModel.deleteMany({ project: { $in: projects } });
    await ProjectModel.deleteMany({ _id: { $in: projects } });
  }
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const demo = existing ?? (await UserModel.create({ name: "Demo User", email: DEMO_EMAIL, passwordHash }));
  const sara =
    (await UserModel.findOne({ email: "sara@taskflow.dev" })) ??
    (await UserModel.create({ name: "Sara Hassan", email: "sara@taskflow.dev", passwordHash }));

  const project = await ProjectModel.create({
    name: "Website relaunch",
    description: "Redesign and ship the new marketing site.",
    owner: demo._id,
    members: [demo._id, sara._id],
  });
  const day = 24 * 60 * 60 * 1000;
  const tasks = await TaskModel.insertMany([
    { project: project._id, title: "Write homepage copy", status: "done", priority: "high", assignee: sara._id, createdBy: demo._id },
    { project: project._id, title: "Design pricing page", status: "in_progress", priority: "high", assignee: demo._id, createdBy: demo._id, dueDate: new Date(Date.now() + 3 * day) },
    { project: project._id, title: "Set up analytics", status: "todo", priority: "medium", createdBy: sara._id, dueDate: new Date(Date.now() + 7 * day) },
    { project: project._id, title: "Compress hero images", status: "todo", priority: "low", assignee: sara._id, createdBy: demo._id },
  ]);
  await CommentModel.create({ task: tasks[1]._id, author: sara._id, body: "Can we show yearly prices by default?" });
  await TaskModel.updateOne({ _id: tasks[1]._id }, { commentCount: 1 });
  await ProjectModel.create({ name: "Personal", description: "Errands and side projects", owner: demo._id, members: [demo._id] });

  console.log(`Seeded. Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDb();
  process.exit(1);
});
