import { IsJWT, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @IsJWT({ message: 'Refresh token không đúng định dạng.' })
  @IsNotEmpty({ message: 'Refresh token không được để trống.' })
  refreshToken!: string;
}
