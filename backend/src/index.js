import express from 'express';
import { registerRoutes } from './routes.js';
import { setupVite } from './vite.js';
import { storage } from './storage.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function startServer() {
  try {
    await storage.initialize();

    if (process.env.NODE_ENV !== 'production') {
      await setupVite(app);
    } else {
      app.use(express.static('public'));
    }

    const server = await registerRoutes(app);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();