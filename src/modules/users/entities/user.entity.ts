import { ApiProperty } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class UserEntity implements User {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @Exclude()
  password: string;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
