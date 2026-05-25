import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../integrations/msal.service.js', () => ({
  getDelegatedToken: vi.fn().mockResolvedValue('mock-access-token'),
}));

vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: vi.fn(),
  },
}));

import { Client } from '@microsoft/microsoft-graph-client';
import {
  buildMessagePayload,
  createOneOnOneChat,
  sendChatMessage,
  sendChannelMessage,
} from '../integrations/graph.service.js';

const mockPost = vi.fn();
const mockApi = vi.fn().mockReturnValue({ post: mockPost });

beforeEach(() => {
  vi.clearAllMocks();
  Client.init.mockReturnValue({ api: mockApi });
  mockApi.mockReturnValue({ post: mockPost });
});

// ---------------------------------------------------------------------------
// buildMessagePayload — pure function, no mocks needed
// ---------------------------------------------------------------------------

describe('buildMessagePayload', () => {
  it('happy path: builds a plain HTML text message with no extras', () => {
    const payload = buildMessagePayload('<p>Hello World</p>');
    expect(payload).toEqual({
      body: { contentType: 'html', content: '<p>Hello World</p>' },
    });
    expect(payload).not.toHaveProperty('attachments');
    expect(payload).not.toHaveProperty('hostedContents');
  });

  it('edge case: includes adaptive card attachment in Graph API shape', () => {
    const attachments = [
      {
        id: '1',
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: '{"type":"AdaptiveCard","version":"1.5","body":[]}',
      },
    ];
    const payload = buildMessagePayload('<attachment id="1"></attachment>', { attachments });
    expect(payload.body.content).toBe('<attachment id="1"></attachment>');
    expect(payload.attachments).toEqual(attachments);
  });

  it('edge case: maps hostedContents to Graph API shape and coerces tempId to string', () => {
    const payload = buildMessagePayload('<img src="../hostedContents/1/$value"/>', {
      hostedContents: [{ tempId: 1, base64: 'abc123==', mimeType: 'image/png' }],
    });
    expect(payload.hostedContents).toEqual([
      {
        '@microsoft.graph.temporaryId': '1',
        contentBytes: 'abc123==',
        contentType: 'image/png',
      },
    ]);
  });

  it('edge case: defaults mimeType to image/png when not specified', () => {
    const payload = buildMessagePayload('<img/>', {
      hostedContents: [{ tempId: '2', base64: 'raw-data' }],
    });
    expect(payload.hostedContents[0].contentType).toBe('image/png');
  });

  it('edge case: composes attachments and hostedContents together (card + image)', () => {
    const attachments = [
      { id: '1', contentType: 'application/vnd.microsoft.card.adaptive', content: '{}' },
    ];
    const hostedContents = [{ tempId: '1', base64: 'img-data', mimeType: 'image/jpeg' }];
    const payload = buildMessagePayload(
      '<attachment id="1"></attachment><img src="../hostedContents/1/$value"/>',
      { attachments, hostedContents }
    );
    expect(payload.attachments).toEqual(attachments);
    expect(payload.hostedContents).toHaveLength(1);
    expect(payload.hostedContents[0]['@microsoft.graph.temporaryId']).toBe('1');
    expect(payload.hostedContents[0].contentType).toBe('image/jpeg');
  });

  it('error path: empty htmlBody produces a valid payload with empty content', () => {
    const payload = buildMessagePayload('');
    expect(payload.body.contentType).toBe('html');
    expect(payload.body.content).toBe('');
    expect(payload).not.toHaveProperty('attachments');
  });

  it('omits attachments key when attachments array is empty', () => {
    const payload = buildMessagePayload('<p>text</p>', { attachments: [] });
    expect(payload).not.toHaveProperty('attachments');
  });

  it('omits hostedContents key when hostedContents array is empty', () => {
    const payload = buildMessagePayload('<p>text</p>', { hostedContents: [] });
    expect(payload).not.toHaveProperty('hostedContents');
  });
});

// ---------------------------------------------------------------------------
// createOneOnOneChat
// ---------------------------------------------------------------------------

describe('createOneOnOneChat', () => {
  beforeEach(() => {
    mockPost.mockResolvedValue({ id: 'chat-id-abc123' });
  });

  it('happy path: returns the chat id from the Graph response', async () => {
    const chatId = await createOneOnOneChat('sender-oid-123', 'target@example.com');
    expect(chatId).toBe('chat-id-abc123');
    expect(mockApi).toHaveBeenCalledWith('/chats');
  });

  it('happy path: posts chatType oneOnOne with two owner members', async () => {
    await createOneOnOneChat('sender-oid', 'user@contoso.com');
    const body = mockPost.mock.calls[0][0];
    expect(body.chatType).toBe('oneOnOne');
    expect(body.members).toHaveLength(2);
    expect(body.members[0].roles).toContain('owner');
    expect(body.members[1].roles).toContain('owner');
  });

  it('edge case: encodes UPN verbatim in odata.bind URL', async () => {
    await createOneOnOneChat('oid-abc', 'special.user@contoso.com');
    const body = mockPost.mock.calls[0][0];
    const senderBinding = body.members[0]['user@odata.bind'];
    const targetBinding = body.members[1]['user@odata.bind'];
    expect(senderBinding).toContain('oid-abc');
    expect(targetBinding).toContain('special.user@contoso.com');
  });

  it('error path: throws when Graph API returns an error', async () => {
    mockPost.mockRejectedValue(new Error('Graph 403 Forbidden'));
    await expect(createOneOnOneChat('sender', 'target')).rejects.toThrow('Graph 403 Forbidden');
  });
});

// ---------------------------------------------------------------------------
// sendChatMessage
// ---------------------------------------------------------------------------

describe('sendChatMessage', () => {
  beforeEach(() => {
    mockPost.mockResolvedValue({ id: 'msg-id-xyz', createdDateTime: '2026-01-01T00:00:00Z' });
  });

  it('happy path: posts to /chats/{chatId}/messages and returns the message', async () => {
    const result = await sendChatMessage('chat-123', '<p>Hello</p>');
    expect(mockApi).toHaveBeenCalledWith('/chats/chat-123/messages');
    expect(result.id).toBe('msg-id-xyz');
  });

  it('happy path: payload body contentType is html', async () => {
    await sendChatMessage('chat-123', '<p>Test</p>');
    const body = mockPost.mock.calls[0][0];
    expect(body.body.contentType).toBe('html');
    expect(body.body.content).toBe('<p>Test</p>');
  });

  it('edge case: includes hostedContents in the payload for image sends', async () => {
    await sendChatMessage('chat-123', '<img src="../hostedContents/1/$value"/>', {
      hostedContents: [{ tempId: '1', base64: 'image-base64', mimeType: 'image/png' }],
    });
    const body = mockPost.mock.calls[0][0];
    expect(body.hostedContents).toBeDefined();
    expect(body.hostedContents[0]['@microsoft.graph.temporaryId']).toBe('1');
  });

  it('edge case: includes adaptive card attachment', async () => {
    const attachments = [
      { id: '1', contentType: 'application/vnd.microsoft.card.adaptive', content: '{"type":"AdaptiveCard"}' },
    ];
    await sendChatMessage('chat-123', '<attachment id="1"></attachment>', { attachments });
    const body = mockPost.mock.calls[0][0];
    expect(body.attachments).toEqual(attachments);
  });

  it('error path: propagates 429 Graph throttling errors', async () => {
    mockPost.mockRejectedValue(new Error('429 Too Many Requests'));
    await expect(sendChatMessage('chat-abc', '<p>Hi</p>')).rejects.toThrow('429 Too Many Requests');
  });
});

// ---------------------------------------------------------------------------
// sendChannelMessage
// ---------------------------------------------------------------------------

describe('sendChannelMessage', () => {
  beforeEach(() => {
    mockPost.mockResolvedValue({ id: 'chan-msg-1', createdDateTime: '2026-01-01T00:00:00Z' });
  });

  it('happy path: posts to /teams/{teamId}/channels/{channelId}/messages', async () => {
    const result = await sendChannelMessage('team-id-1', 'channel-id-2', '<p>Alert</p>');
    expect(mockApi).toHaveBeenCalledWith('/teams/team-id-1/channels/channel-id-2/messages');
    expect(result.id).toBe('chan-msg-1');
  });

  it('edge case: includes adaptive card attachment in channel message', async () => {
    const attachments = [
      { id: '1', contentType: 'application/vnd.microsoft.card.adaptive', content: '{"type":"AdaptiveCard"}' },
    ];
    await sendChannelMessage('t1', 'c1', '<attachment id="1"></attachment>', { attachments });
    const body = mockPost.mock.calls[0][0];
    expect(body.attachments).toEqual(attachments);
    expect(body.body.content).toBe('<attachment id="1"></attachment>');
  });

  it('error path: throws when team or channel does not exist (Graph 404)', async () => {
    mockPost.mockRejectedValue(new Error('404 Not Found'));
    await expect(sendChannelMessage('bad-team', 'bad-chan', '<p>msg</p>')).rejects.toThrow('404 Not Found');
  });
});
