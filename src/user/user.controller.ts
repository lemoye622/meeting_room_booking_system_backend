import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { EmailService } from 'src/email/email.service';
import { RedisService } from 'src/redis/redis.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { RequireLogin, UserInfo } from 'src/custom.decorator';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserDto } from './dto/udpate-user.dto';
import { generateParseInPipe } from 'src/utils';
import { ApiBearerAuth, ApiBody, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginUserVo } from './vo/login-user.vo';
import { RefreshTokenVo } from './vo/refresh-token.vo';
import { UserDetailVo } from './vo/user-info.vo';
import { UserListVo } from './vo/user-list.vo';

@ApiTags('用户管理模块')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('init-data')
  async initData() {
    await this.userService.initData();
    return 'done';
  }

  @ApiBody({type: RegisterUserDto})
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '该邮箱已注册/验证码已失效/验证码不正确/该用户已存在',
    type: String
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '注册成功/失败',
    type: String
  })
  @Post('register')
  async register(@Body() registerUserDto: RegisterUserDto) {
    return await this.userService.register(registerUserDto);
  }

  @ApiQuery({
    name: 'address',
    type: String,
    description: '邮箱地址',
    required: true,
    example: 'xxx@xx.com'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '发送成功',
    type: String
  })
  @Get('register-captcha')
  async captcha(@Query('address') address: string) {
    const code = Math.random().toString().slice(2, 8);
    await this.redisService.set(`captcha_${address}`, code, 5 * 60);
    await this.emailService.sendMail({
      to: address,
      subject: '注册验证码',
      html: `<p>你的注册验证码是 ${code}</p>`,
    });
    return '发送成功';
  }

  @ApiBody({
    type: LoginUserDto
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '用户不存在/密码错误',
    type: String
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '用户信息和 token',
    type: LoginUserVo
  })
  @Post('login')
  async userLogin(@Body() loginUserDto: LoginUserDto) {
    const vo = await this.userService.login(loginUserDto, false);
    const { access_token, refresh_token } =
    this.userService.getAccessAndRefreshToken(vo.userInfo);
    vo.accessToken = access_token;
    vo.refreshToken = refresh_token;
    return vo;
  }

  @ApiQuery({
    name: 'refreshToken',
    type: String,
    description: '刷新 token',
    required: true,
    example: 'xxxxxxxxyyyyyyyyzzzzz'
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'token 已失效，请重新登录'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '刷新成功',
    type: RefreshTokenVo
  })
  @Get('refresh')
  async refresh(@Query('refreshToken') refreshToken: string) {
    try {
      const data = this.jwtService.verify(refreshToken);
      const user = await this.userService.findUserById(data.userId, false);
      const { access_token, refresh_token } =
        this.userService.getAccessAndRefreshToken(user);

      const vo = new RefreshTokenVo();
      vo.access_token = access_token;
      vo.refresh_token = refresh_token;
      return vo;
    } catch (error) {
      throw new UnauthorizedException('token 已失效，请重新登录');
    }
  }

  @ApiBody({
    type: LoginUserDto
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '用户不存在/密码错误',
    type: String
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '用户信息和 token',
    type: LoginUserVo
  })
  @Post('admin/login')
  async adminLogin(@Body() loginUserDto: LoginUserDto) {
    const vo = await this.userService.login(loginUserDto, true);
    const { access_token, refresh_token } =
      this.userService.getAccessAndRefreshToken(vo.userInfo);
    vo.accessToken = access_token;
    vo.refreshToken = refresh_token;
    return vo;
  }

  @ApiQuery({
    name: 'refreshToken',
    type: String,
    description: '刷新 token',
    required: true,
    example: 'xxxxxxxxyyyyyyyyzzzzz'
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'token 已失效，请重新登录'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '刷新成功',
    type: RefreshTokenVo
  })
  @Get('admin/refresh')
  async adminRefresh(@Query('refreshToken') refreshToken: string) {
    try {
      const data = this.jwtService.verify(refreshToken);
      const user = await this.userService.findUserById(data.userId, true);
      const { access_token, refresh_token } =
        this.userService.getAccessAndRefreshToken(user);

      const vo = new RefreshTokenVo();
      vo.access_token = access_token;
      vo.refresh_token = refresh_token;
      return vo;
    } catch (e) {
      throw new UnauthorizedException('token 已失效，请重新登录');
    }
  }

  @ApiBearerAuth()
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'success',
    type: UserDetailVo
  })
  @Get('info')
  @RequireLogin()
  async info(@UserInfo('userId') userId: number) {
    return  await this.userService.findUserDetailById(userId);
  }

  @ApiBody({
    type: UpdateUserPasswordDto
  })
  @ApiResponse({
    type: String,
    description: '验证码已失效/不正确'
  })
  // @Post 写个数组，表示数组里的这两个路由是同一个 handler 处理
  @Post(['update_password', 'admin/update_password'])
  async updatePassword(@Body() passwordDto: UpdateUserPasswordDto) {
    return await this.userService.updatePassword(passwordDto);
  }

  @ApiQuery({
    name: 'address',
    description: '邮箱地址',
    type: String
  })
  @ApiResponse({
    type: String,
    description: '发送成功'
  })
  @Get('update_password/captcha')
  async updatePasswordCaptcha(@Query('address') address: string) {
    const code = Math.random().toString().slice(2,8);
    await this.redisService.set(`update_password_captcha_${address}`, code, 10 * 60);
    await this.emailService.sendMail({
      to: address,
      subject: '更改密码验证码',
      html: `<p>你的更改密码验证码是 ${code}</p>`
    });
    return '发送成功';
  }

  @ApiBearerAuth()
  @ApiBody({
    type: UpdateUserDto
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '验证码已失效/不正确'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '更新成功',
    type: String
  })
  @Post(['update', 'admin/update'])
  @RequireLogin()
  async updateUserInfo(@UserInfo('userId') userId: number, @Body() updateUserDto: UpdateUserDto) {
    return await this.userService.updateUserInfo(userId, updateUserDto);
  }

  @ApiBearerAuth()
  @ApiResponse({
    type: String,
    description: '发送成功'
  })
  @RequireLogin()
  @Get('update/captcha')
  async updateCaptcha(@UserInfo('email') address: string) {
    const code = Math.random().toString().slice(2,8);
    await this.redisService.set(`update_user_captcha_${address}`, code, 10 * 60);
    await this.emailService.sendMail({
      to: address,
      subject: '更改用户信息验证码',
      html: `<p>你的验证码是 ${code}</p>`
    });
    return '发送成功';
  }

  @ApiBearerAuth()
  @ApiQuery({
    name: 'id',
    description: 'userId',
    type: Number
  })
  @ApiResponse({
    type: String,
    description: 'success'
  })
  @RequireLogin()
  @Get('freeze')
  async freeze(@Query('id') userId: number) {
    await this.userService.freezeUserById(userId);
    return 'success';
  }

  @ApiBearerAuth()
  @ApiQuery({
    name: 'page',
    description: '页数',
    type: Number
  })
  @ApiQuery({
    name: 'limit',
    description: '每页条数',
    type: Number
  })
  @ApiQuery({
    name: 'username',
    description: '用户名',
    type: String
  })
  @ApiQuery({
    name: 'nickName',
    description: '昵称',
    type: String
  })
  @ApiQuery({
    name: 'email',
    description: '邮箱地址',
    type: String
  })
  @ApiResponse({
    type: UserListVo,
    description: '用户列表'
  })
  @RequireLogin()
  @Get('list')
  async list(
    @Query('page', new DefaultValuePipe(1), generateParseInPipe('page')) page: number, 
    @Query('limit', new DefaultValuePipe(2), generateParseInPipe('limit')) limit: number,
    @Query('username') username: string,
    @Query('nickName') nickName: string,
    @Query('email') email: string
  ) {
    return await this.userService.findUsers(username, nickName, email, page, limit);
  }
}
