import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SUPABASE } from '../common/supabase/supabase.module';

@Injectable()
export class UploadService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: any,
    private readonly config: ConfigService,
  ) {}

  async uploadMenuImage(file: Express.Multer.File) {
    const bucket = this.config.get<string>('SUPABASE_BUCKET') || 'menu-images';
    const ext = (file.originalname.split('.').pop() || 'png').toLowerCase();
    const filename = `${randomUUID()}.${ext}`;
    const path = `menus/${filename}`;

    const { error: upErr } = await this.supabase.storage
      .from(bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

    if (upErr) {
      throw new InternalServerErrorException({ message: 'upload failed', error: upErr.message });
    }

    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = data?.publicUrl;
    if (!publicUrl) throw new InternalServerErrorException('cannot get public url');

    return { url: publicUrl, path };
  }
}
