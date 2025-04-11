const express = require('express');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(express.json());

app.post('/log-visit', (req, res) => {
  const { timestamp, userAgent } = req.body;
  const logEntry = `New Visitor: \nTime: ${timestamp}\nUserAgent: ${userAgent}\n\n`;

  // Save to a local file
  fs.appendFile('visitors.txt', logEntry, err => {
    if (err) {
      console.error('Error writing to file:', err);
      return res.status(500).send('Error saving data');
    }
    res.send('Logged successfully');
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
