import { Controller, Post, UploadedFile, UseGuards, UseInterceptors, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly service: UploadService) {}

  @Post('menu-image')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadMenuImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file required');

    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) {
      throw new BadRequestException('only image files are allowed');
    }

    try {
      return await this.service.uploadMenuImage(file);
    } catch (e: any) {
      throw new InternalServerErrorException({ message: 'upload error', error: String(e?.message || e) });
    }
  }
}
