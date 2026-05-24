const fs = require('fs');
const path = require('path');

const brainDir = '/Users/pray4skylark/.gemini/antigravity/brain';

function scan() {
  if (!fs.existsSync(brainDir)) {
    console.log('Brain directory does not exist.');
    return;
  }

  const dirs = fs.readdirSync(brainDir).filter(f => {
    return fs.statSync(path.join(brainDir, f)).isDirectory() && f !== 'tempmediaStorage';
  });

  const results = [];

  for (const dir of dirs) {
    const fullPath = path.join(brainDir, dir);
    let summary = '내용 없음 (임시 또는 빈 세션)';
    let artifacts = [];

    // md 파일 탐색
    try {
      const files = fs.readdirSync(fullPath);
      artifacts = files.filter(f => f.endsWith('.md') && f !== 'walkthrough.md' && !f.includes('.resolved'));
    } catch (e) {}

    // transcript.jsonl 탐색
    const transcriptPath = path.join(fullPath, '.system_generated', 'logs', 'transcript.jsonl');
    const overviewPath = path.join(fullPath, '.system_generated', 'logs', 'overview.txt');

    if (fs.existsSync(transcriptPath)) {
      try {
        const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line);
          if (parsed.type === 'USER_INPUT' && parsed.content) {
            summary = cleanContent(parsed.content);
            break;
          }
        }
      } catch (e) {}
    } else if (fs.existsSync(overviewPath)) {
      try {
        const content = fs.readFileSync(overviewPath, 'utf8');
        // JSON 형태의 USER_INPUT 매칭 시도
        const match = content.match(/"type":"USER_INPUT"[^}]*"content":"([^"]*)"/);
        if (match && match[1]) {
          // JSON 인코딩 문자 정제
          const rawText = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          summary = cleanContent(rawText);
        } else {
          // 일반 텍스트 첫 150자 추출
          summary = content.split('\n').filter(l => l.trim()).slice(0, 2).join(' ').substring(0, 150);
        }
      } catch (e) {}
    }

    // 만약 여전히 기본값이고 md 파일들이 있다면 md 파일들의 성격으로 유추
    if (summary.includes('내용 없음') && artifacts.length > 0) {
      summary = `아티팩트 [${artifacts.join(', ')}] 생성 작업 세션`;
    }

    results.push({
      id: dir,
      summary,
      artifacts: artifacts.length > 0 ? artifacts.join(', ') : '없음'
    });
  }

  // 가독성을 위한 출력
  console.log(JSON.stringify(results, null, 2));
}

function cleanContent(text) {
  let clean = text.replace(/<USER_REQUEST>[\s\S]*?<\/USER_REQUEST>/, (m) => {
    return m.replace(/<\/?USER_REQUEST>/g, '').trim();
  });
  clean = clean.replace(/<[^>]*>/g, '').trim();
  clean = clean.split('\n')[0]; // 첫 줄만 확보
  if (clean.length > 80) {
    clean = clean.substring(0, 80) + '...';
  }
  return clean;
}

scan();
