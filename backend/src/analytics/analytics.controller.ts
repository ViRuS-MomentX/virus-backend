import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UAParser } from 'ua-parser-js';
import { AnalyticsService } from './analytics.service';
import { CreateVisitDto } from './dto/create-visit.dto';

function resolveDeviceType(deviceType: string | undefined): string {
  if (deviceType === 'mobile') return 'Mobile';
  if (deviceType === 'tablet') return 'Tablet';
  return 'Desktop'; // ua-parser-js doesn't set deviceType for desktop UAs
}

function resolveIp(
  forwardedFor: string | undefined,
  realIp: string | undefined,
  req: Request,
): string | null {
  if (forwardedFor) {
    // x-forwarded-for may contain a comma-separated list; the first entry is the client
    return forwardedFor.split(',')[0].trim();
  }
  if (realIp) return realIp;
  return req.socket?.remoteAddress ?? null;
}

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('visit')
  async trackVisit(
    @Body() body: CreateVisitDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-vercel-ip-country') vercelCountry: string | undefined,
    @Headers('x-vercel-ip-country-region') vercelRegion: string | undefined,
    @Headers('x-vercel-ip-city') vercelCity: string | undefined,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Headers('x-real-ip') realIp: string | undefined,
  ) {
    const parser = new UAParser(userAgent ?? '');
    const os = parser.getOS();
    const browser = parser.getBrowser();
    const device = parser.getDevice();

    const osString = [os.name, os.version].filter(Boolean).join(' ') || null;
    const browserString =
      [browser.name, browser.version?.split('.')[0]].filter(Boolean).join(' ') || null;

    const visit = await this.analyticsService.createVisit({
      ip: resolveIp(forwardedFor, realIp, req),
      country: vercelCountry ? decodeURIComponent(vercelCountry) : null,
      region: vercelRegion ? decodeURIComponent(vercelRegion) : null,
      city: vercelCity ? decodeURIComponent(vercelCity) : null,
      device: resolveDeviceType(device.type),
      os: osString,
      browser: browserString,
      page: body.page,
    });

    return { success: true, visit };
  }

  @Get('visits')
  async getVisits(
    @Query('limit') limit?: string,
    @Headers('x-admin-key') adminKey?: string,
  ) {
    const expectedKey = process.env.ANALYTICS_ADMIN_KEY;

    if (!expectedKey || adminKey !== expectedKey) {
      throw new UnauthorizedException();
    }

    const parsedLimit = Math.min(Number(limit) || 500, 500);
    return this.analyticsService.getRecentVisits(parsedLimit);
  }
}
