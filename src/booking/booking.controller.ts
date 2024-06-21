import { Controller, Get, DefaultValuePipe, Query, Post, Body, Param } from '@nestjs/common';
import { BookingService } from './booking.service';
import { generateParseIntPipe } from 'src/utils';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UserInfo } from 'src/custom.decorator';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('list')
  async list(
    @Query('page', new DefaultValuePipe(1), generateParseIntPipe('page')) page: number,
    @Query('size', new DefaultValuePipe(10), generateParseIntPipe('size')) size: number,
    @Query('username') username: string,
    @Query('meetingRoomName') meetingRoomName: string,
    @Query('meetingRoomPosition') meetingRoomPosition: string,
    @Query('bookingTimeRangeStart') bookingTimeRangeStart: number,
    @Query('bookingTimeRangeEnd') bookingTimeRangeEnd: number
  ) {
    return this.bookingService.find(page, size, username, meetingRoomName, meetingRoomPosition, bookingTimeRangeStart, bookingTimeRangeEnd);
  }

  @Post('add')
  async add(@Body() bookingDto: CreateBookingDto, @UserInfo('userId') userId: number) {
    return await this.bookingService.add(bookingDto, userId);
  }

  @Get("apply/:id")
  async apply(@Param('id') id: number) {
    return this.bookingService.apply(id);
  }

  @Get("reject/:id")
  async reject(@Param('id') id: number) {
    return this.bookingService.reject(id);
  }

  @Get("unbind/:id")
  async unbind(@Param('id') id: number) {
    return this.bookingService.unbind(id);
  }
}
