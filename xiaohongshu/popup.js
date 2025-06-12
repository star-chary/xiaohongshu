document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('exportBtn').addEventListener('click', exportNotes);
});

// 导出笔记为CSV
async function exportNotes() {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = '正在获取笔记数据...';

    try {
        // 在当前活动标签页中执行脚本
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: scrapeXiaohongshuNote
        });

        const notes = results[0].result;

        if (notes && notes.length > 0) {
            // 转换为CSV并下载
            const csv = convertToCSV(notes);
            downloadCSV(csv);
            statusDiv.textContent = `成功导出 ${notes.length} 条笔记!`;
        } else {
            statusDiv.textContent = '未找到笔记内容，请确认您在正确的页面。';
        }
    } catch (error) {
        console.error(error);
        statusDiv.textContent = '导出失败: ' + error.message;
    }
}

// 专门针对小红书笔记页面的爬取函数
function scrapeXiaohongshuNote() {
    console.log("正在爬取小红书笔记...");
    const notes = [];

    try {
        // 针对小红书笔记详情页
        if (window.location.href.includes('xiaohongshu.com') &&
            (window.location.href.includes('/discovery/item/') ||
                window.location.href.includes('/explore/'))) {

            // 获取标题 - 小红书通常在这些位置
            let title = '';
            const possibleTitleElements = document.querySelectorAll('h1, .title, .note-content .content');
            for (const el of possibleTitleElements) {
                if (el.textContent.trim()) {
                    title = el.textContent.trim();
                    break;
                }
            }

            // 获取作者名
            let author = '';
            const possibleAuthorElements = document.querySelectorAll('.author, .nickname, .user-nickname, .user-name');
            for (const el of possibleAuthorElements) {
                if (el.textContent.trim()) {
                    author = el.textContent.trim();
                    break;
                }
            }

            // 判断内容类型
            const hasVideo = document.querySelector('video, .video-container, .videoframe') !== null;
            const contentType = hasVideo ? '视频' : '图文';

            // 获取内容文字
            let content = '';
            const possibleContentElements = document.querySelectorAll('.content, .desc, .note-content p, .note-desc');
            for (const el of possibleContentElements) {
                if (el.textContent.trim()) {
                    // 避免选到标题部分
                    if (el.textContent.trim() !== title) {
                        content += el.textContent.trim() + ' ';
                    }
                }
            }

            // 如果仍未找到内容，尝试查找所有段落
            if (!content) {
                document.querySelectorAll('p').forEach(p => {
                    if (p.textContent.trim() && p.textContent.trim() !== title) {
                        content += p.textContent.trim() + ' ';
                    }
                });
            }

            console.log("找到内容:", { title, author, contentType, content });

            if (title || content) {
                notes.push({
                    title: title || '无标题',
                    author: author || '未知作者',
                    contentType,
                    content: content || '无内容'
                });
            }
        }

        // 针对小红书首页的多个笔记
        if (window.location.href.includes('xiaohongshu.com') &&
            (window.location.href === 'https://www.xiaohongshu.com/' ||
                window.location.href.includes('/explore'))) {

            // 尝试获取首页的笔记卡片
            const noteCards = document.querySelectorAll('.note-card, .feed-card, .explore-card, [data-v-note]');

            noteCards.forEach(card => {
                const title = card.querySelector('.title, .desc')?.textContent.trim() || '无标题';
                const author = card.querySelector('.user-name, .nickname')?.textContent.trim() || '未知作者';
                const hasVideo = card.querySelector('video, .video-icon') !== null;
                const contentType = hasVideo ? '视频' : '图文';
                const content = card.querySelector('.desc, .content')?.textContent.trim() || '';

                notes.push({
                    title,
                    author,
                    contentType,
                    content
                });
            });
        }

        // 调试信息
        console.log(`找到 ${notes.length} 条笔记`);
    } catch (error) {
        console.error("爬取过程中出错:", error);
    }

    return notes;
}

// 转换为CSV格式
function convertToCSV(notes) {
    // CSV表头
    const headers = ['标题', '作者', '类型', '内容'];
    const csvRows = [];

    // 添加表头
    csvRows.push(headers.join(','));

    // 添加数据行
    for (const note of notes) {
        // 处理CSV中的特殊字符
        const escapedValues = [
            `"${(note.title || '').replace(/"/g, '""')}"`,
            `"${(note.author || '').replace(/"/g, '""')}"`,
            `"${note.contentType || ''}"`,
            `"${(note.content || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(escapedValues.join(','));
    }

    return csvRows.join('\n');
}

// 下载CSV文件
function downloadCSV(csv) {
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);

    const a = document.createElement('a');
    a.href = url;
    a.download = `小红书笔记_${today}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
