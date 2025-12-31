import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc } from 'drizzle-orm';
import * as schema from './schema';
import { FundParams, Investment as InvestmentType, InvestmentStage, InvestmentStatus } from '@/types';

// Get database connection - returns null if DATABASE_URL is not set
function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return null;
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

// Fund operations
export async function getFund(id: string) {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  const result = await db.select().from(schema.funds).where(eq(schema.funds.id, id)).limit(1);
  return result[0] || null;
}

export async function getOrCreateDefaultFund() {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  const existing = await db.select().from(schema.funds).orderBy(desc(schema.funds.createdAt)).limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const defaultParams: FundParams = {
    fundSize: 25_000_000,
    fundLife: 10,
    mgmtFeeRate: 0.02,
    mgmtFeeFullYears: 4,
    mgmtFeeStepdown: 0.7,
    carry: 0.20,
    targetConvictionCount: 22,
    graduationRate: 0.25,
    discoveryCheckSize: 100_000,
    convictionCheckSize: 400_000,
    convictionCheckMin: 250_000,
    convictionCheckMax: 750_000,
    followOnReservePercent: 0.20,
    discoverySuccessRate: 0.30,
    convictionSuccessRate: 0.50,
  };

  const result = await db.insert(schema.funds).values({
    name: 'PMF Fund I',
    params: defaultParams,
  }).returning();

  return result[0];
}

export async function updateFundParams(id: string, params: FundParams) {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  const result = await db.update(schema.funds)
    .set({ params, updatedAt: new Date() })
    .where(eq(schema.funds.id, id))
    .returning();
  return result[0] || null;
}

// Investment operations
export async function getInvestments(fundId: string) {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  return db.select()
    .from(schema.investments)
    .where(eq(schema.investments.fundId, fundId))
    .orderBy(desc(schema.investments.investmentDate));
}

export async function createInvestment(
  fundId: string,
  investment: {
    companyName: string;
    stage: InvestmentStage;
    status: InvestmentStatus;
    discoveryAmount: number;
    convictionAmount: number;
    followOnAmount: number;
    entryValuation: number;
    currentValuation: number;
    lastValuationDate: string;
    investmentDate: string;
    graduationDate?: string;
    exitDate?: string;
    exitValue?: number;
    notes?: string;
  }
) {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  const result = await db.insert(schema.investments).values({
    fundId,
    companyName: investment.companyName,
    stage: investment.stage,
    status: investment.status,
    discoveryAmount: investment.discoveryAmount.toString(),
    convictionAmount: investment.convictionAmount.toString(),
    followOnAmount: investment.followOnAmount.toString(),
    entryValuation: investment.entryValuation.toString(),
    currentValuation: investment.currentValuation.toString(),
    lastValuationDate: investment.lastValuationDate,
    investmentDate: investment.investmentDate,
    graduationDate: investment.graduationDate || null,
    exitDate: investment.exitDate || null,
    exitValue: investment.exitValue?.toString() || null,
    notes: investment.notes || null,
  }).returning();

  return result[0];
}

export async function updateInvestment(
  id: string,
  updates: Partial<{
    companyName: string;
    stage: InvestmentStage;
    status: InvestmentStatus;
    discoveryAmount: number;
    convictionAmount: number;
    followOnAmount: number;
    currentValuation: number;
    lastValuationDate: string;
    graduationDate: string;
    exitDate: string;
    exitValue: number;
    notes: string;
  }>
) {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (updates.companyName !== undefined) updateData.companyName = updates.companyName;
  if (updates.stage !== undefined) updateData.stage = updates.stage;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.discoveryAmount !== undefined) updateData.discoveryAmount = updates.discoveryAmount.toString();
  if (updates.convictionAmount !== undefined) updateData.convictionAmount = updates.convictionAmount.toString();
  if (updates.followOnAmount !== undefined) updateData.followOnAmount = updates.followOnAmount.toString();
  if (updates.currentValuation !== undefined) updateData.currentValuation = updates.currentValuation.toString();
  if (updates.lastValuationDate !== undefined) updateData.lastValuationDate = updates.lastValuationDate;
  if (updates.graduationDate !== undefined) updateData.graduationDate = updates.graduationDate;
  if (updates.exitDate !== undefined) updateData.exitDate = updates.exitDate;
  if (updates.exitValue !== undefined) updateData.exitValue = updates.exitValue.toString();
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const result = await db.update(schema.investments)
    .set(updateData)
    .where(eq(schema.investments.id, id))
    .returning();

  return result[0] || null;
}

export async function deleteInvestment(id: string) {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  await db.delete(schema.investments).where(eq(schema.investments.id, id));
  return true;
}

// Valuation operations
export async function getValuationHistory(investmentId: string) {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  return db.select()
    .from(schema.valuationUpdates)
    .where(eq(schema.valuationUpdates.investmentId, investmentId))
    .orderBy(desc(schema.valuationUpdates.date));
}

export async function addValuationUpdate(
  investmentId: string,
  valuation: number,
  date: string,
  notes?: string
) {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  // Insert valuation update
  const result = await db.insert(schema.valuationUpdates).values({
    investmentId,
    valuation: valuation.toString(),
    date,
    notes: notes || null,
  }).returning();

  // Update investment's current valuation
  await db.update(schema.investments)
    .set({
      currentValuation: valuation.toString(),
      lastValuationDate: date,
      updatedAt: new Date(),
    })
    .where(eq(schema.investments.id, investmentId));

  return result[0];
}

// Helper to convert DB investment to frontend type
export function dbInvestmentToInvestment(dbInv: schema.Investment): InvestmentType {
  const discoveryAmount = parseFloat(dbInv.discoveryAmount || '0');
  const convictionAmount = parseFloat(dbInv.convictionAmount || '0');
  const followOnAmount = parseFloat(dbInv.followOnAmount || '0');
  const totalInvested = discoveryAmount + convictionAmount + followOnAmount;
  const exitValue = dbInv.exitValue ? parseFloat(dbInv.exitValue) : undefined;

  return {
    id: dbInv.id,
    companyName: dbInv.companyName,
    stage: dbInv.stage as InvestmentStage,
    status: dbInv.status as InvestmentStatus,
    discoveryAmount,
    convictionAmount,
    followOnAmount,
    totalInvested,
    entryValuation: parseFloat(dbInv.entryValuation || '0'),
    currentValuation: parseFloat(dbInv.currentValuation || '0'),
    lastValuationDate: dbInv.lastValuationDate,
    investmentDate: dbInv.investmentDate,
    graduationDate: dbInv.graduationDate || undefined,
    exitDate: dbInv.exitDate || undefined,
    exitValue,
    exitMultiple: exitValue ? exitValue / totalInvested : undefined,
    notes: dbInv.notes || undefined,
    createdAt: dbInv.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: dbInv.updatedAt?.toISOString() || new Date().toISOString(),
  };
}
