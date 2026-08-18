import { scryptSync } from "node:crypto";

const password = "AminMaster!2026";
const salt = "d3b07c4eb4b36f0c40d9178ce2a5d0f1";
const derived = scryptSync(password, salt, 64).toString("hex");
console.log(`scrypt$${salt}$${derived}`);
