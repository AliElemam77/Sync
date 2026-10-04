import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { AddParticipantsDto } from './dto/add-participants.dto';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';

const MAX_MESSAGES_PAGE_SIZE = 100;

@Controller('api/v1/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Get all active conversations and groups for the authenticated user
   */
  @Get('conversations')
  async getConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.chatService.getConversations(user.id);
  }

  /**
   * Get details of a single conversation
   */
  @Get('conversations/:id')
  async getConversationById(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.getConversationById(conversationId, user.id);
  }

  /**
   * Get paginated messages for a conversation
   */
  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.chatService.getMessages(
      conversationId,
      user.id,
      Math.max(page, 1),
      Math.min(Math.max(limit, 1), MAX_MESSAGES_PAGE_SIZE),
    );
  }

  /**
   * Get or initiate a 1-to-1 direct conversation with another employee/user
   */
  @Post('conversations/direct')
  async getOrCreateDirectConversation(
    @Body() dto: CreateDirectConversationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.getOrCreateDirectConversation(user.id, dto.targetUserId);
  }

  /**
   * Create a new Work Group or Public Group channel
   */
  @Post('conversations/group')
  async createGroup(
    @Body() dto: CreateGroupDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.createGroup(user.id, dto);
  }

  /**
   * Send a message to a conversation
   */
  @Post('messages')
  async sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.sendMessage(user.id, dto);
  }

  /**
   * Edit an existing message
   */
  @Patch('messages/:id')
  async editMessage(
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body() dto: EditMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.editMessage(messageId, user.id, dto.content);
  }

  /**
   * Soft-delete a message
   */
  @Delete('messages/:id')
  async deleteMessage(
    @Param('id', ParseUUIDPipe) messageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.deleteMessage(messageId, user.id);
  }

  /**
   * Toggle emoji reaction on a message
   */
  @Post('messages/:id/reactions')
  async toggleReaction(
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body() dto: ToggleReactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.toggleReaction(messageId, user.id, dto.emoji);
  }

  /**
   * Add members to a group conversation
   */
  @Post('conversations/:id/participants')
  async addParticipants(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: AddParticipantsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.addParticipants(conversationId, user.id, dto);
  }

  /**
   * Mark all messages in a conversation as read
   */
  @Patch('conversations/:id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.markAsRead(conversationId, user.id);
  }
}
