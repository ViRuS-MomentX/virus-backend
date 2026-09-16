import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateVisitDto {
  @IsString()
  @IsNotEmpty()
  page: string;

  // источник перехода: хост реферера или метка из ссылки (?ref=tg)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referrer?: string;

  // язык браузера: navigator.language, напр. "ru-RU"
  @IsOptional()
  @IsString()
  @MaxLength(16)
  lang?: string;
}
