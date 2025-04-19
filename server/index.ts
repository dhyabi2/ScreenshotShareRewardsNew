import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { distributeRewards } from "./routes/rewardRoutes";
import { poolWallet } from "./utils/poolWallet";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Check if pool wallet is configured
    if (poolWallet.isConfigured()) {
      log("🔄 Pool wallet found. Setting up automatic reward distribution.", "poolWallet");
      
      // Initialize pool at startup
      poolWallet.getPoolBalance().then(balance => {
        log(`Pool wallet initialized with ${balance.toFixed(6)} XNO`, "poolWallet");
      }).catch(error => {
        log(`Error initializing pool wallet: ${error.message}`, "poolWallet");
      });
      
      // Set up automatic reward distribution every 24 hours
      const DISTRIBUTION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
      
      // Schedule first distribution after 1 hour of server start
      const firstDistributionDelay = 60 * 60 * 1000; // 1 hour
      
      setTimeout(() => {
        // Start the daily distribution schedule
        const scheduleNextDistribution = () => {
          log("Starting reward distribution...", "rewardDistribution");
          
          distributeRewards().then(result => {
            if (result.success) {
              log(`✅ Reward distribution complete. Distributed ${result.totalDistributed} XNO to creators`, "rewardDistribution");
            } else {
              log(`❌ Reward distribution failed: ${result.error}`, "rewardDistribution");
            }
            
            // Schedule next distribution
            setTimeout(scheduleNextDistribution, DISTRIBUTION_INTERVAL);
          }).catch(error => {
            log(`Error in reward distribution: ${error.message}`, "rewardDistribution");
            // Schedule next distribution even if this one failed
            setTimeout(scheduleNextDistribution, DISTRIBUTION_INTERVAL);
          });
        };
        
        // Start the schedule
        scheduleNextDistribution();
      }, firstDistributionDelay);
    } else {
      log("⚠️ No pool wallet configured. Automatic reward distribution disabled.", "poolWallet");
    }
  });
})();
