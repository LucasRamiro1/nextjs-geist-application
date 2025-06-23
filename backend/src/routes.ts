import { Express, Request, Response, NextFunction } from "express";
import { createServer, Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage.js";
import {
  insertUserSchema,
  insertBetSchema,
  insertRewardSchema,
  insertSystemSettingSchema,
  insertBroadcastMessageSchema,
  insertAnalysisPeriodSchema,
} from "../shared/schema.js";
import { z } from "zod";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    console.log("Admin dashboard connected");

    ws.on("message", (message: string) => {
      try {
        const data: WebSocketMessage = JSON.parse(message);
        console.log("Received message:", data);
      } catch (error) {
        console.error("Invalid WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      console.log("Admin dashboard disconnected");
    });
  });

  const broadcast = (data: WebSocketMessage): void => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  const checkAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId) {
      return res.status(401).json({ error: "Unauthorized - Missing telegram ID" });
    }

    const user = await storage.getUserByTelegramId(Number(telegramId));
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Forbidden - Admin access required" });
    }

    next();
  };

  app.use(['/api/analysis-periods', '/api/system-settings', '/api/broadcasts'], checkAdmin);

  // User Routes
  app.post("/api/user/register", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.registerUser(userData);
      res.json(user);
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Bet Routes
  app.post("/api/report-bet", async (req: Request, res: Response) => {
    try {
      const betData = insertBetSchema.parse(req.body);
      const bet = await storage.submitBetReport(betData);
      res.json(bet);
    } catch (error) {
      console.error("Error submitting bet:", error);
      res.status(500).json({ error: "Error submitting bet" });
    }
  });

  // User History
  app.get("/api/users/:telegramId/history", async (req: Request, res: Response) => {
    try {
      const { telegramId } = req.params;
      const history = await storage.getUserHistory(Number(telegramId));
      res.json(history);
    } catch (error) {
      console.error("Error fetching user history:", error);
      res.status(500).json({ error: "Error fetching history" });
    }
  });

  // Points
  app.get("/api/users/:telegramId/points", async (req: Request, res: Response) => {
    try {
      const { telegramId } = req.params;
      const user = await storage.getUserByTelegramId(Number(telegramId));
      res.json({ points: user?.points || 0 });
    } catch (error) {
      console.error("Error fetching points:", error);
      res.status(500).json({ error: "Error fetching points" });
    }
  });

  // Analysis
  app.post("/api/analyze", async (req: Request, res: Response) => {
    try {
      const result = await storage.purchaseAnalysis(req.body);
      res.json(result);
    } catch (error) {
      console.error("Error processing analysis:", error);
      res.status(500).json({ error: "Error processing analysis" });
    }
  });

  // Group Analysis
  app.post("/api/analyze_all", async (req: Request, res: Response) => {
    try {
      const result = await storage.purchaseGroupAnalysis(req.body);
      res.json(result);
    } catch (error) {
      console.error("Error processing group analysis:", error);
      res.status(500).json({ error: "Error processing group analysis" });
    }
  });

  // Admin Routes
  app.post("/api/users/promote", async (req: Request, res: Response) => {
    try {
      const result = await storage.promoteUser(req.body);
      res.json(result);
    } catch (error) {
      console.error("Error promoting user:", error);
      res.status(500).json({ error: "Error promoting user" });
    }
  });

  // System Settings
  app.get("/api/system-settings", async (_req: Request, res: Response) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Error fetching settings" });
    }
  });

  // Broadcasts
  app.get("/api/broadcasts/pending", async (_req: Request, res: Response) => {
    try {
      const broadcasts = await storage.getPendingBroadcasts();
      res.json(broadcasts);
    } catch (error) {
      console.error("Error fetching broadcasts:", error);
      res.status(500).json({ error: "Error fetching broadcasts" });
    }
  });

  // Bot Logo
  app.post("/api/bot/logo", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { logoUrl } = req.body;
      if (!logoUrl) {
        return res.status(400).json({ error: "Logo URL is required" });
      }
      await storage.updateBotLogo(logoUrl);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating bot logo:", error);
      res.status(500).json({ error: "Failed to update bot logo" });
    }
  });

  app.get("/api/bot/logo", async (_req: Request, res: Response) => {
    try {
      const logoUrl = await storage.getBotLogo();
      res.json({ logoUrl });
    } catch (error) {
      console.error("Error fetching bot logo:", error);
      res.status(500).json({ error: "Failed to fetch bot logo" });
    }
  });

  // Analysis Periods
  app.get("/api/analysis-periods", async (_req: Request, res: Response) => {
    try {
      const periods = await storage.getAnalysisPeriods();
      res.json(periods);
    } catch (error) {
      console.error("Error fetching analysis periods:", error);
      res.status(500).json({ error: "Failed to fetch analysis periods" });
    }
  });

  app.post("/api/analysis-periods", async (req: Request, res: Response) => {
    try {
      const periodData = insertAnalysisPeriodSchema.parse(req.body);
      const period = await storage.createAnalysisPeriod(periodData);
      broadcast({ type: "analysis_period_created", period });
      res.json(period);
    } catch (error) {
      console.error("Error creating analysis period:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid period data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create analysis period" });
      }
    }
  });

  app.put("/api/analysis-periods/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const periodData = insertAnalysisPeriodSchema.partial().parse(req.body);
      await storage.updateAnalysisPeriod(Number(id), periodData);
      broadcast({ type: "analysis_period_updated", periodId: id });
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating analysis period:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid period data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update analysis period" });
      }
    }
  });

  app.delete("/api/analysis-periods/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteAnalysisPeriod(Number(id));
      broadcast({ type: "analysis_period_deleted", periodId: id });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting analysis period:", error);
      res.status(500).json({ error: "Failed to delete analysis period" });
    }
  });

  return httpServer;
}