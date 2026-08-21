import { IsString, IsNotEmpty } from 'class-validator';

export class CreateVisitDto {
  @IsString()
  @IsNotEmpty()
  page: string;
}
