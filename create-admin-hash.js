const bcrypt = require("bcryptjs");

async function main() {
  const password = process.argv[2];

  if (!password) {
    console.error('Uso: node create-admin-hash.js "LaTuaPasswordAdmin"');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  console.log(hash);
}

main().catch((error) => {
  console.error("Errore generazione hash:", error);
  process.exit(1);
});
