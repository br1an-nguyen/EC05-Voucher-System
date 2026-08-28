import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as dns from 'node:dns';
dotenv.config({ path: path.join(__dirname, '../../.env') }); // Ensure exact path relative to this file

// Force Node.js to prefer IPv4 over IPv6 for DNS resolution
// This prevents ENETUNREACH errors on networks with broken IPv6 routing
dns.setDefaultResultOrder('ipv4first');

export interface PasswordResetDelivery {
  email: string;
  resetUrl: string;
  expiresAt: Date;
}

@Injectable()
export class PasswordResetDeliveryService {
  private readonly logger = new Logger(PasswordResetDeliveryService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    // Không đọc process.env ở đây vì ConfigModule có thể chưa load xong
  }

  async deliver(delivery: PasswordResetDelivery): Promise<void> {
    const fs = require('fs');
    fs.appendFileSync('delivery-log.txt', `\n--- DELIVER CALLED ---\n`);
    fs.appendFileSync('delivery-log.txt', `GMAIL_USER: ${process.env.GMAIL_USER}\n`);
    
    console.log('--- DELIVER CALLED ---');
    console.log('GMAIL_USER:', process.env.GMAIL_USER);
    console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '***' : 'undefined');

    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      fs.appendFileSync('delivery-log.txt', `ERROR: Missing credentials\n`);
      console.error('LỖI: GMAIL_USER hoặc GMAIL_APP_PASSWORD không có!');
      throw new Error('Tính năng gửi email chưa được cấu hình (Thiếu GMAIL_USER/GMAIL_APP_PASSWORD).');
    }

    if (!this.transporter) {
      const dnsPromises = require('node:dns').promises;
      let hostIp = 'smtp.gmail.com';
      try {
        const ips = await dnsPromises.resolve4('smtp.gmail.com');
        if (ips && ips.length > 0) {
          hostIp = ips[0];
          this.logger.log(`[SMTP] Resolved smtp.gmail.com to IPv4: ${hostIp}`);
        }
      } catch (err) {
        this.logger.warn(`[SMTP] Failed to resolve IPv4 for smtp.gmail.com`);
      }

      this.transporter = nodemailer.createTransport({
        host: hostIp,
        port: 465,
        secure: true,
        tls: {
          servername: 'smtp.gmail.com', // Bắt buộc khi dùng IP
        },
        auth: {
          user: user,
          pass: pass,
        },
      });
    }

    const { email, resetUrl, expiresAt } = delivery;
    
    // Log for debugging
    this.logger.log(`Đang gửi email khôi phục mật khẩu đến: ${email}`);
    this.logger.log(`Reset URL: ${resetUrl}`);

    const mailOptions = {
      from: `"VoucherNow Support" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Yêu cầu đặt lại mật khẩu - VoucherNow',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #f97316; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">VoucherNow</h1>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #1f2937; margin-top: 0;">Xin chào,</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với email này.
              Vui lòng nhấp vào nút bên dưới để tạo mật khẩu mới.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Đặt Lại Mật Khẩu
              </a>
            </div>
            <p style="color: #4b5563; line-height: 1.6; font-size: 14px;">
              Liên kết này sẽ hết hạn vào lúc: <strong>${expiresAt.toLocaleString('vi-VN')}</strong>.
              <br><br>
              Nếu bạn không yêu cầu đặt lại mật khẩu, xin vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.
            </p>
          </div>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
            © ${new Date().getFullYear()} VoucherNow. Mọi quyền được bảo lưu.
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Đã gửi email khôi phục mật khẩu thành công đến: ${email}`);
    } catch (error) {
      this.logger.error(`Lỗi khi gửi email đến ${email}:`, error);
      throw new Error('Không thể gửi email. Vui lòng thử lại sau.');
    }
  }
}
