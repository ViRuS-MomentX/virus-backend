import { Injectable } from '@nestjs/common';
import { neon } from '@neondatabase/serverless';

export interface VisitInput {
  country: string | null;
  region: string | null;
  city: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  page: string;
}

export interface Visit {
  id: number;
  visited_at: string;
  country: string | null;
  region: string | null;
  city: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  page: string;
}

@Injectable()
export class AnalyticsService {
  private readonly sql = neon(process.env.DATABASE_URL as string);

  async createVisit(input: VisitInput): Promise<Visit> {
    const rows = await this.sql`
      INSERT INTO visits (country, region, city, device, os, browser, page)
      VALUES (${input.country}, ${input.region}, ${input.city}, ${input.device}, ${input.os}, ${input.browser}, ${input.page})
      RETURNING *
    `;
    return rows[0] as Visit;
  }

  async getRecentVisits(limit = 500): Promise<Visit[]> {
    const rows = await this.sql`
      SELECT *
      FROM visits
      ORDER BY visited_at DESC
      LIMIT ${limit}
    `;
    return rows as Visit[];
  }
}
