import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Between, EntityManager, LessThanOrEqual, Like, MoreThanOrEqual } from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { MeetingRoom } from 'src/meeting-room/entities/meeting-room.entity';
import { Booking } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RedisService } from 'src/redis/redis.service';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class BookingService {
  @InjectEntityManager()
  private entityManager: EntityManager;

  @Inject(RedisService)
  private redisService: RedisService;

  @Inject(EmailService)
  private emailService: EmailService;

  async initData() {
    const user1 = await this.entityManager.findOneBy(User, {
      id: 5
    });
    const user2 = await this.entityManager.findOneBy(User, {
      id: 8
    });

    const room1 = await this.entityManager.findOneBy(MeetingRoom, {
      id: 30
    });
    const room2 = await await this.entityManager.findOneBy(MeetingRoom, {
      id: 33
    });

    const booking1 = new Booking();
    booking1.room = room1;
    booking1.user = user1;
    booking1.startTime = new Date();
    booking1.endTime = new Date(Date.now() + 1000 * 60 * 60);

    await this.entityManager.save(Booking, booking1);

    const booking2 = new Booking();
    booking2.room = room2;
    booking2.user = user2;
    booking2.startTime = new Date();
    booking2.endTime = new Date(Date.now() + 1000 * 60 * 60);

    await this.entityManager.save(Booking, booking2);

    const booking3 = new Booking();
    booking3.room = room1;
    booking3.user = user2;
    booking3.startTime = new Date();
    booking3.endTime = new Date(Date.now() + 1000 * 60 * 60);

    await this.entityManager.save(Booking, booking3);

    const booking4 = new Booking();
    booking4.room = room2;
    booking4.user = user1;
    booking4.startTime = new Date();
    booking4.endTime = new Date(Date.now() + 1000 * 60 * 60);

    await this.entityManager.save(Booking, booking4);
  }

  async find(page: number, size: number, username: string, meetingRoomName: string, meetingRoomPosition: string, bookingTimeRangeStart: number, bookingTimeRangeEnd: number) {
    const skipCount = (page - 1) * size;
    const condition: Record<string, any> = {};

    if (username) {
      condition.user = {
        username: Like(`%${username}%`)
      }
    }

    if(meetingRoomName) {
      condition.room =  {
        name: Like(`%${meetingRoomName}%`)
      }
    }

    if(meetingRoomPosition) {
      if (!condition.room) {
        condition.room = {}
      }
      condition.room.location = Like(`%${meetingRoomPosition}%`)
    }

    if(bookingTimeRangeStart) {
      if(!bookingTimeRangeEnd) {
        bookingTimeRangeEnd = bookingTimeRangeStart + 60 * 60 * 1000
      }
      condition.startTime = Between(new Date(bookingTimeRangeStart), new Date(bookingTimeRangeEnd))
    }

    const [bookings, totalCount] = await this.entityManager.findAndCount(Booking, {
      // where: {
      //   user: {
      //     username: Like(`%${username}%`)
      //   },
      //   room: {
      //     name: Like(`%${meetingRoomName}%`),
      //     location: Like(`%${meetingRoomPosition}%`)
      //   },
      //   startTime: Between(new Date(bookingTimeRangeStart), new Date(bookingTimeRangeEnd))
      // },
      where: condition,
      relations: {
        user: true,
        room: true,
      },
      skip: skipCount,
      take: size
    });

    return {
      bookings: bookings.map(item => {
        delete item.user.password;
        return item;
      }),
      totalCount
    }
  }

  async add(bookingDto: CreateBookingDto, userId: number) {
    const meetingRoom = await this.entityManager.findOneBy(MeetingRoom, {
      id: bookingDto.meetingRoomId
    });

    if(!meetingRoom) {
      throw new BadRequestException('会议室不存在');
    }

    const user = await this.entityManager.findOneBy(User, {
      id: userId
    });

    const booking = new Booking();
    booking.room = meetingRoom;
    booking.user = user;
    booking.startTime = new Date(bookingDto.startTime);
    booking.endTime = new Date(bookingDto.endTime);

    // 做个限制：同一个会议室一段时间内只能被预定一次
    // 即保证查询已经预定的记录里有没有包含这段时间
    const res = this.entityManager.findOneBy(Booking, {
      room: meetingRoom,
      startTime: LessThanOrEqual(booking.startTime),
      endTime: MoreThanOrEqual(booking.endTime)
    });
    if (res) {
      throw new BadRequestException('该时间段已被预定');
    }

    await this.entityManager.save(Booking, booking);
  }

  async apply(id: number) {
    await this.entityManager.update(Booking, {
      id
    }, {
      status: '审批通过'
    });
    return 'success'
  }

  async reject(id: number) {
    await this.entityManager.update(Booking, {
      id
    }, {
      status: '审批驳回'      
    });
    return 'success'
  }

  async unbind(id: number) {
    await this.entityManager.update(Booking, {
      id
    }, {
      status: '已解除'      
    });
    return 'success'
  }

  async urge(id: number) {
    // 先用 redisService 查询 flag，查到的话就提醒半小时内只能催办一次
    // 然后用 redisService 查询 admin 的邮箱，没查到的话到数据库查，然后存到 redis
    // 之后发催办邮件，并且在 redis 里存一个 30 分钟的 flag
    const flag = await this.redisService.get('urge_' + id);
    if (flag) {
      return '半小时内只能催办一次，请耐心等待';
    }

    let email = await this.redisService.get('admin_email');

    if (!email) {
      const admin = await this.entityManager.findOne(User, {
        select: {
          email: true
        },
        where: {
          isAdmin: true
        }
      });

      email = admin.email;

      this.redisService.set('admin_email', admin.email);
    }

    this.emailService.sendMail({
      to: email,
      subject: '预定申请催办提醒',
      html: `id 为 ${id} 的预定申请正在等待审批`
    });

    this.redisService.set('urge_' + id, 1, 60 * 30);
  }
}
