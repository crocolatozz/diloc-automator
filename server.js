const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(express.static(__dirname, {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Chrome Extension MV3 Studio listening on http://${HOST}:${PORT}`);
});
