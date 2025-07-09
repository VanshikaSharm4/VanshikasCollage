const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

const app = express();
const PORT = process.env.PORT || 3001;
const DRAWINGS_DIR = path.join(__dirname, 'drawings');

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow large images

// Ensure drawings directory exists
if (!fs.existsSync(DRAWINGS_DIR)) {
  fs.mkdirSync(DRAWINGS_DIR);
}

// POST /upload: receive base64 PNG and save to disk
app.post('/upload', (req, res) => {
  const { image } = req.body;
  if (!image || !image.startsWith('data:image/png;base64,')) {
    return res.status(400).json({ error: 'Invalid image data' });
  }
  const base64Data = image.replace(/^data:image\/png;base64,/, '');
  const filename = `drawing_${Date.now()}_${Math.floor(Math.random()*10000)}.png`;
  const filepath = path.join(DRAWINGS_DIR, filename);
  fs.writeFile(filepath, base64Data, 'base64', (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to save image' });
    }
    res.json({ success: true, filename });
  });
});

// GET /collage: generate and return a collage of all drawings
app.get('/collage', async (req, res) => {
  try {
    const files = fs.readdirSync(DRAWINGS_DIR).filter(f => f.endsWith('.png'));
    if (files.length === 0) {
      return res.status(404).json({ error: 'No drawings found' });
    }
    // Load all images
    const images = await Promise.all(files.map(f => Jimp.read(path.join(DRAWINGS_DIR, f))));
    // Collage grid size
    const cols = Math.ceil(Math.sqrt(images.length));
    const rows = Math.ceil(images.length / cols);
    const cellWidth = 200;
    const cellHeight = 200;
    // Create blank collage
    const collage = new Jimp(cellWidth * cols, cellHeight * rows, 0xffffffff);
    images.forEach((img, i) => {
      img.cover(cellWidth, cellHeight);
      const x = (i % cols) * cellWidth;
      const y = Math.floor(i / cols) * cellHeight;
      collage.composite(img, x, y);
    });
    // Send as PNG
    collage.getBuffer(Jimp.MIME_PNG, (err, buffer) => {
      if (err) return res.status(500).json({ error: 'Failed to create collage' });
      res.set('Content-Type', 'image/png');
      res.send(buffer);
    });
  } catch (err) {
    res.status(500).json({ error: 'Error generating collage' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 