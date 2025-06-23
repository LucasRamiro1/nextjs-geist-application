import {
  users,
  bets,
  rewards,
  pendingApprovals,
  systemSettings,
  broadcastMessages,
  analysisPeriods,
  botSettings,
  type User,
  type InsertUser,
  type Bet,
  type InsertBet,
  type Reward,
  type InsertReward,
  type PendingApproval,
  type SystemSetting,
  type InsertSystemSetting,
  type BroadcastMessage,
  type InsertBroadcastMessage,
  type AnalysisPeriod,
  type InsertAnalysisPeriod,
} from "../shared/schema.js";
import { db } from "./db.js";
import { eq, desc, and, or, sql, count, sum } from "drizzle-orm";

interface DashboardStats {
  totalUsers: number;
  pendingBets: number;
  totalPoints: number;
  monthlyRevenue: number;
  userGrowth: number[];
  platformDistribution: { platform: string; count: number }[];
}

export class DatabaseStorage {
  // USERS
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByTelegramId(telegramId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async registerUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).onConflictDoNothing().returning();
    if (!created) throw new Error("Failed to create user");
    return created;
  }

  async updateUserPoints(userId: number, points: number): Promise<void> {
    await db.update(users)
      .set({ points: sql`${users.points} + ${points}`, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async getAllUsers(offset = 0, limit = 50): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt)).offset(offset).limit(limit);
  }

  async getUsersCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(users);
    return result.count;
  }

  async banUser(userId: number): Promise<void> {
    await db.update(users).set({ isBanned: true, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async unbanUser(userId: number): Promise<void> {
    await db.update(users).set({ isBanned: false, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async promoteUser(data: { telegramId: number }): Promise<{ success: boolean }> {
    const user = await this.getUserByTelegramId(data.telegramId);
    if (!user) throw new Error("Usuário não encontrado");
    await db.update(users).set({ updatedAt: new Date() }).where(eq(users.id, user.id));
    return { success: true };
  }

  // BETS
  async createBet(bet: InsertBet): Promise<Bet> {
    const [created] = await db.insert(bets).values(bet).returning();
    if (!created) throw new Error("Failed to create bet");
    return created;
  }

  async submitBetReport(bet: InsertBet): Promise<Bet> {
    return await this.createBet(bet);
  }

  async getBet(id: number): Promise<Bet | undefined> {
    const [bet] = await db.select().from(bets).where(eq(bets.id, id));
    return bet;
  }

  async getPendingBets(): Promise<Bet[]> {
    return await db.select().from(bets).where(eq(bets.isApproved, false)).orderBy(desc(bets.createdAt));
  }

  async approveBet(betId: number, adminId: number): Promise<void> {
    await db.update(bets).set({
      isApproved: true,
      approvedBy: adminId,
      approvalDate: new Date(),
      updatedAt: new Date()
    }).where(eq(bets.id, betId));
  }

  async rejectBet(betId: number): Promise<void> {
    await db.delete(bets).where(eq(bets.id, betId));
  }

  async getUserBets(userId: number): Promise<Bet[]> {
    return await db.select().from(bets).where(eq(bets.userId, userId)).orderBy(desc(bets.createdAt));
  }

  async getUserHistory(telegramId: number): Promise<Bet[]> {
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) return [];
    return await this.getUserBets(user.id);
  }

  async getBetsByDateRange(start: Date, end: Date): Promise<Bet[]> {
    return await db.select().from(bets).where(and(
      sql`${bets.createdAt} >= ${start}`,
      sql`${bets.createdAt} <= ${end}`
    ));
  }

  async purchaseAnalysis(data: { telegramId: number; timePeriod: number }): Promise<{ success: boolean }> {
    const user = await this.getUserByTelegramId(data.telegramId);
    if (!user) throw new Error("Usuário não encontrado");
    await this.updateUserPoints(user.id, -25);
    return { success: true };
  }

  async purchaseGroupAnalysis(data: { telegramId: number; timePeriod: number }): Promise<{ success: boolean }> {
    const user = await this.getUserByTelegramId(data.telegramId);
    if (!user) throw new Error("Usuário não encontrado");
    await this.updateUserPoints(user.id, -500);
    return { success: true };
  }

  // REWARDS
  async createReward(data: InsertReward): Promise<Reward> {
    const [reward] = await db.insert(rewards).values(data).returning();
    if (!reward) throw new Error("Failed to create reward");
    return reward;
  }

  async getReward(code: string): Promise<Reward | undefined> {
    const [reward] = await db.select().from(rewards).where(eq(rewards.code, code));
    return reward;
  }

  async useReward(code: string, userId: number): Promise<boolean> {
    const reward = await this.getReward(code);
    if (!reward || reward.isUsed || (reward.expiresAt && reward.expiresAt < new Date())) return false;

    await db.update(rewards).set({ isUsed: true, userId }).where(eq(rewards.code, code));
    await this.updateUserPoints(userId, parseFloat(reward.points.toString()));
    return true;
  }

  async getActiveRewards(): Promise<Reward[]> {
    return await db.select().from(rewards).where(and(
      eq(rewards.isUsed, false),
      or(sql`${rewards.expiresAt} IS NULL`, sql`${rewards.expiresAt} > NOW()`)
    )).orderBy(desc(rewards.createdAt));
  }

  // SETTINGS
  async getSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting;
  }

  async setSetting(setting: InsertSystemSetting): Promise<void> {
    await db.insert(systemSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: setting.value, updatedAt: new Date() }
      });
  }

  async getAllSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings);
  }

  // BOT SETTINGS
  async getBotLogo(): Promise<string | undefined> {
    const [settings] = await db.select().from(botSettings).limit(1);
    return settings?.logoUrl;
  }

  async updateBotLogo(logoUrl: string): Promise<void> {
    await db.insert(botSettings)
      .values({ logoUrl })
      .onConflictDoUpdate({
        target: botSettings.id,
        set: { logoUrl, updatedAt: new Date() }
      });
  }

  // BROADCASTS
  async createBroadcastMessage(data: InsertBroadcastMessage): Promise<BroadcastMessage> {
    const [msg] = await db.insert(broadcastMessages).values(data).returning();
    if (!msg) throw new Error("Failed to create broadcast message");
    return msg;
  }

  async getBroadcastHistory(): Promise<BroadcastMessage[]> {
    return await db.select().from(broadcastMessages).orderBy(desc(broadcastMessages.sentAt)).limit(10);
  }

  async getPendingBroadcasts(): Promise<BroadcastMessage[]> {
    return await db.select().from(broadcastMessages)
      .where(sql`${broadcastMessages.sentAt} IS NULL`)
      .orderBy(desc(broadcastMessages.sentAt));
  }

  // ANALYSIS PERIODS
  async getAnalysisPeriods(): Promise<AnalysisPeriod[]> {
    return await db.select().from(analysisPeriods).where(eq(analysisPeriods.isActive, true));
  }

  async createAnalysisPeriod(data: InsertAnalysisPeriod): Promise<AnalysisPeriod> {
    const [period] = await db.insert(analysisPeriods).values(data).returning();
    if (!period) throw new Error("Failed to create analysis period");
    return period;
  }

  async updateAnalysisPeriod(id: number, data: Partial<InsertAnalysisPeriod>): Promise<void> {
    await db.update(analysisPeriods).set(data).where(eq(analysisPeriods.id, id));
  }

  async deleteAnalysisPeriod(id: number): Promise<void> {
    await db.update(analysisPeriods).set({ isActive: false }).where(eq(analysisPeriods.id, id));
  }

  // DASHBOARD ANALYTICS
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Basic statistics
      const [usersResult] = await db.select({ count: count() }).from(users);
      const [pendingResult] = await db.select({ count: count() }).from(bets).where(eq(bets.isApproved, false));
      
      // Total points with null handling
      const [pointsResult] = await db.select({ total: sum(users.points) }).from(users);
      const totalPoints = parseFloat(pointsResult.total?.toString() || "0");

      // Platform distribution
      const platformStats = await db.select({ 
        platform: bets.platform, 
        count: count() 
      }).from(bets).groupBy(bets.platform);

      // Monthly revenue calculation - using bet_amount instead of amount
      const monthlyRevenue = await this.calculateMonthlyRevenue(new Date().getMonth());

      // User growth trend
      const userGrowth = await this.getUserGrowthTrend();

      return {
        totalUsers: usersResult.count || 0,
        pendingBets: pendingResult.count || 0,
        totalPoints,
        monthlyRevenue,
        userGrowth,
        platformDistribution: platformStats.map(stat => ({
          platform: stat.platform || 'Unknown',
          count: Number(stat.count) || 0
        }))
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw new Error('Failed to fetch dashboard statistics');
    }
  }

  // Helper methods
  private async calculateMonthlyRevenue(month: number): Promise<number> {
    const result = await db.select({ 
      revenue: sum(bets.betAmount) // Changed from amount to betAmount
    })
      .from(bets)
      .where(sql`EXTRACT(MONTH FROM ${bets.createdAt}) = ${month + 1}`);
    return parseFloat(result[0]?.revenue?.toString() || "0");
  }

  private async getUserGrowthTrend(): Promise<number[]> {
    const growth = await db.select({
      month: sql`EXTRACT(MONTH FROM ${users.createdAt})`,
      count: count()
    })
      .from(users)
      .groupBy(sql`EXTRACT(MONTH FROM ${users.createdAt})`)
      .orderBy(sql`EXTRACT(MONTH FROM ${users.createdAt})`);
    
    return growth.map(g => Number(g.count));
  }
}

export const storage = new DatabaseStorage();