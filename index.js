const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const reviewRoutes = require('./routes/review');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://admin:admin1234@cluster0.edubkxs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cho phép trả file upload qua url /uploads/...
app.use('/uploads', express.static('uploads'));

// Route Review
app.use('/api/review', reviewRoutes);

// Connect MongoDB và start server
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    app.listen(PORT, () => console.log('Server running at http://localhost:' + PORT));
  })
  .catch(err => {
    console.error('Mongo error', err);
  });
app.get('/ping', (req, res) => {
  res.send('pong');
});
