const bcrypt = require('bcrypt');

async function generate() {
  const hash = await bcrypt.hash('admin123', 10);
  console.log('Generated Hash:', hash);
}

generate();
