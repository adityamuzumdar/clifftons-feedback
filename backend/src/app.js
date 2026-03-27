const express = require('express');
const cors = require('cors');
const path = require('path');
const adminRoutes = require('./routes/admin');
const joinRoutes = require('./routes/join');
const submitRoutes = require('./routes/submit');
const resultsRoutes = require('./routes/results');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

app.use('/api/admin', adminRoutes);
app.use('/api/join', joinRoutes);
app.use('/api/submit', submitRoutes);
app.use('/api/results', resultsRoutes);

// In production, serve the Angular build
if (isProd) {
  const distPath = path.join(__dirname, '../../frontend/dist/clifton-feedback/browser');
  app.use(express.static(distPath));
  // All non-API routes go to Angular's index.html (client-side routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
