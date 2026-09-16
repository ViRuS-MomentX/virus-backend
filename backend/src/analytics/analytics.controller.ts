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

// Источник перехода. Метка из ссылки (?ref=tg) и реферер сводятся к
// понятным названиям. Из приложений Telegram/Discord реферер часто пустой,
// поэтому явная метка в ссылке — самый надёжный сигнал.
function resolveSource(referrer: string | undefined): string {
  const r = (referrer ?? '').trim().toLowerCase();
  if (!r) return 'Прямой';
  if (['tg', 'telegram', 't.me'].some((k) => r.includes(k))) return 'Telegram';
  if (['dc', 'discord'].some((k) => r.includes(k))) return 'Discord';
  if (r.includes('youtu')) return 'YouTube';
  if (r.includes('tiktok')) return 'TikTok';
  if (r.includes('github')) return 'GitHub';
  if (r.includes('google')) return 'Google';
  if (r.includes('yandex')) return 'Яндекс';
  if (r === 'vk' || r.includes('vk.com')) return 'VK';
  return r; // незнакомый источник сохраняем как есть
}

// Язык сводим к основному тегу: "ru-RU" → "ru", "pt-BR" → "pt".
function resolveLang(lang: string | undefined): string | null {
  const primary = (lang ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(primary) ? primary : null;
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
    @Headers('accept-language') acceptLang: string | undefined,
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
      // язык из тела, а если его нет — из заголовка Accept-Language
      lang: resolveLang(body.lang ?? acceptLang?.split(',')[0]),
      source: resolveSource(body.referrer),
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
