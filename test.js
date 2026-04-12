
    const SUPABASE_URL = 'https://yowpwrziyxuljhsewlrm.supabase.co'
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvd3B3cnppeXh1bGpoc2V3bHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNzU4MzYsImV4cCI6MjA5MDk1MTgzNn0.rpqjEV5ygfbcEq2JcyLvO7mwlycy2lLeNw-NkEsUhMA'
    const { createClient } = supabase
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    let allLeads = [], allBrands = [], allUsers = []
    let currentLead = null, selectedResult = '', dragLeadId = null
    let currentBrandId = null, currentUser = null, pendingInviteLink = null

    const statusColors = {
      '신규': '#1e3a5f|#3b82f6', '상담중': '#3a2e1a|#f59e0b',
      '미팅준비': '#3a1a1a|#f97316', '계약검토': '#2a1a3a|#a855f7',
      '완료': '#1a3a1a|#22c55e', '보류': '#1f1f1f|#6b7280'
    }

    function getBadge(status) {
      const [bg, color] = (statusColors[status] || '#1f1f1f|#6b7280').split('|')
      return `<span class="badge" style="background:${bg};color:${color}">${status}</span>`
    }

    function isMobile() { return window.innerWidth <= 768 }

    // ===== 초대 =====
    function checkInviteToken() {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('invite')
      if (!token) return false
      try {
        const invite = JSON.parse(atob(token))
        if (Date.now() > invite.expires) { alert('초대 링크가 만료됐어요.'); return false }
        pendingInviteLink = invite
        document.getElementById('loginScreen').classList.add('hidden')
        document.getElementById('inviteScreen').classList.remove('hidden')
        return true
      } catch { return false }
    }

    async function completeInvite() {
      const name = document.getElementById('inviteName').value
      const password = document.getElementById('invitePassword').value
      const errEl = document.getElementById('inviteError')
      if (!name || password.length < 8) { errEl.textContent = '이름과 8자 이상 비밀번호를 입력해주세요'; errEl.classList.remove('hidden'); return }
      const email = `invite_${Date.now()}@jungchongmoo.com`
      const { data, error } = await sb.auth.signUp({ email, password })
      if (error) { errEl.textContent = error.message; errEl.classList.remove('hidden'); return }
      await sb.from('users').insert({ id: data.user.id, role: pendingInviteLink.role, name, email, company_id: pendingInviteLink.brandId || null })
      alert('가입 완료! 로그인해주세요.')
      window.location.href = window.location.pathname
    }

    // ===== 인증 =====
    async function login() {
      const email = document.getElementById('email').value
      const password = document.getElementById('password').value
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) { document.getElementById('errorMsg').classList.remove('hidden'); return }
      initApp(data.user)
    }

    async function logout() {
      await sb.auth.signOut()
      document.getElementById('app').classList.add('hidden')
      document.getElementById('loginScreen').classList.remove('hidden')
    }

    async function initApp(user) {
      currentUser = user
      document.getElementById('loginScreen').classList.add('hidden')
      document.getElementById('inviteScreen').classList.add('hidden')
      document.getElementById('app').classList.remove('hidden')
      if (document.getElementById('sidebarEmail')) document.getElementById('sidebarEmail').textContent = user.email
      await loadBrands()
      await loadLeads()
      await loadTeam()
      if (isMobile()) showMobileScreen('home')
      else showScreen('dashboard')
    }

    // ===== 브랜드 =====
    async function loadBrands() {
      const { data } = await sb.from('brands').select('*').order('name')
      allBrands = data || []
      const opts = allBrands.map(b => `<option value="${b.id}">${b.name}</option>`).join('')
      const noOpt = '<option value="">선택 안함</option>'
      const allOpt = '<option value="">전체 브랜드</option>'
      if (document.getElementById('brandSelect')) document.getElementById('brandSelect').innerHTML = allOpt + opts
      if (document.getElementById('inviteBrandId')) document.getElementById('inviteBrandId').innerHTML = noOpt + opts
      if (document.getElementById('uploadBrandId')) document.getElementById('uploadBrandId').innerHTML = noOpt + opts
      if (document.getElementById('addBrand')) document.getElementById('addBrand').innerHTML = noOpt + opts
      if (document.getElementById('mInviteBrandId')) document.getElementById('mInviteBrandId').innerHTML = noOpt + opts
      if (document.getElementById('mUploadBrandId')) document.getElementById('mUploadBrandId').innerHTML = noOpt + opts
    }

    async function changeBrand(brandId) { currentBrandId = brandId || null; await loadLeads() }

    function renderBrandList() {
      const html = allBrands.map(b => {
        const bLeads = allLeads.filter(l => l.brand_id === b.id)
        const cnt = bLeads.length
        const done = bLeads.filter(l => l.status === '완료').length
        return `<div class="card p-4">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm" style="background:${b.color}">${b.name[0]}</div>
          <div><p class="font-medium text-sm">${b.name}</p><p class="text-xs text-gray-500">${b.description || '-'}</p></div>
        </div>
        <div class="flex items-center justify-between pt-3" style="border-top:1px solid #1f1f1f">
          <span class="text-xs text-gray-600">리드 ${cnt}건 · 완료 ${done}건</span>
          <div class="flex gap-2">
            <button onclick="changeBrand('${b.id}');${isMobile() ? 'showMobileScreen(\'leads\')' : 'showScreen(\'leads\')'}" class="text-xs text-blue-400">리드 보기</button>
            <button onclick="deleteBrand('${b.id}')" class="text-xs text-red-400">삭제</button>
          </div>
        </div>
      </div>`
      }).join('') || '<p class="text-xs text-gray-600 text-center py-4">브랜드가 없습니다</p>'
      if (document.getElementById('brandList')) document.getElementById('brandList').innerHTML = html
      if (document.getElementById('mobileBrandList')) document.getElementById('mobileBrandList').innerHTML = html
    }

    function showAddBrand() { document.getElementById('addBrandModal').classList.remove('hidden') }
    function closeAddBrand() { document.getElementById('addBrandModal').classList.add('hidden') }

    async function addBrand() {
      const name = document.getElementById('brandName').value
      if (!name) return alert('브랜드명을 입력해주세요')
      await sb.from('brands').insert({ name, description: document.getElementById('brandDesc').value, color: document.getElementById('brandColor').value })
      closeAddBrand()
      document.getElementById('brandName').value = ''
      document.getElementById('brandDesc').value = ''
      await loadBrands(); renderBrandList()
    }

    async function deleteBrand(id) {
      if (!confirm('정말 삭제할까요?')) return
      await sb.from('brands').delete().eq('id', id)
      await loadBrands(); renderBrandList()
    }

    // ===== 팀 =====
    async function loadTeam() {
      const { data } = await sb.from('users').select('*').order('created_at')
      allUsers = data || []
      renderTeamList()
    }

    function renderTeamList() {
      const roleLabels = { super_admin: '슈퍼어드민', manager: '매니저', viewer: '뷰어' }
      const roleColors = { super_admin: '#1e3a5f|#3b82f6', manager: '#1a3a1a|#22c55e', viewer: '#3a2e1a|#f59e0b' }
      const html = allUsers.length ? allUsers.map(u => {
        const [bg, color] = (roleColors[u.role] || '#1f1f1f|#6b7280').split('|')
        const brand = allBrands.find(b => b.id === u.company_id)
        return `<div class="flex items-center justify-between p-3 rounded-lg" style="background:#0d0d0d;border:1px solid #1f1f1f;">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-300">${(u.name || '?')[0]}</div>
          <div><p class="text-sm font-medium">${u.name || '-'}</p><p class="text-xs text-gray-500">${brand ? brand.name : '전체'}</p></div>
        </div>
        <span class="badge" style="background:${bg};color:${color}">${roleLabels[u.role] || u.role}</span>
      </div>`
      }).join('') : '<p class="text-xs text-gray-600 text-center py-4">팀원이 없습니다</p>'
      if (document.getElementById('teamList')) document.getElementById('teamList').innerHTML = html
      if (document.getElementById('mobileTeamList')) document.getElementById('mobileTeamList').innerHTML = html
    }

    function generateInviteLink() {
      const role = document.getElementById('inviteRole').value
      const brandId = document.getElementById('inviteBrandId').value
      const token = btoa(JSON.stringify({ role, brandId, expires: Date.now() + 24 * 60 * 60 * 1000 }))
      const link = `${window.location.origin}${window.location.pathname}?invite=${token}`
      document.getElementById('inviteLinkInput').value = link
      document.getElementById('inviteLinkBox').classList.remove('hidden')
    }

    function generateMobileInviteLink() {
      const role = document.getElementById('mInviteRole').value
      const brandId = document.getElementById('mInviteBrandId').value
      const token = btoa(JSON.stringify({ role, brandId, expires: Date.now() + 24 * 60 * 60 * 1000 }))
      const link = `${window.location.origin}${window.location.pathname}?invite=${token}`
      document.getElementById('mInviteLinkInput').value = link
      document.getElementById('mInviteLinkBox').classList.remove('hidden')
    }

    function copyInviteLink() { navigator.clipboard.writeText(document.getElementById('inviteLinkInput').value); alert('복사됐어요!') }
    function copyMobileInviteLink() { navigator.clipboard.writeText(document.getElementById('mInviteLinkInput').value); alert('복사됐어요!') }

    function shareKakao() {
      const link = document.getElementById('inviteLinkInput').value
      const msg = `정총무 CRM에 초대합니다!\n${link}`
      if (navigator.share) navigator.share({ title: '정총무 CRM 초대', text: msg, url: link })
      else { navigator.clipboard.writeText(msg); alert('초대 메시지가 복사됐어요! 카카오톡에 붙여넣기 해주세요.') }
    }

    function shareMobileKakao() {
      const link = document.getElementById('mInviteLinkInput').value
      const msg = `정총무 CRM에 초대합니다!\n${link}`
      if (navigator.share) navigator.share({ title: '정총무 CRM 초대', text: msg, url: link })
      else { navigator.clipboard.writeText(msg); alert('초대 메시지 복사됐어요!') }
    }

    // ===== 리드 =====
    async function loadLeads() {
      let query = sb.from('leads').select('*').order('created_at', { ascending: false })
      if (currentBrandId) query = query.eq('brand_id', currentBrandId)
      const { data } = await query
      allLeads = data || []
      renderDashboard()
      renderLeadsTable(allLeads)
      renderPipeline()
      renderBrandList()
      renderMobileHome()
      renderMobileLeads(allLeads)
    }

    function renderDashboard() {
      const now = new Date()
      const total = allLeads.length
      const newThisMonth = allLeads.filter(l => { const d = new Date(l.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() }).length
      const done = allLeads.filter(l => l.status === '완료').length
      const overdue = allLeads.filter(l => l.next_contact_at && new Date(l.next_contact_at) < now && l.status !== '완료').length
      const targetContract = Math.max(1, Math.round(total * 0.05))
      const currentRate = total > 0 ? ((done / total) * 100).toFixed(1) : 0
      const achieveRate = Math.min(100, Math.round((done / targetContract) * 100))

      if (document.getElementById('kpiNew')) {
        document.getElementById('kpiNew').textContent = newThisMonth
        document.getElementById('kpiTotal').textContent = total
        document.getElementById('kpiDone').textContent = done
        document.getElementById('kpiOverdue').textContent = overdue
        document.getElementById('targetContract').textContent = targetContract + '건'
        document.getElementById('currentRate').textContent = currentRate + '%'
        document.getElementById('contractAchieve').textContent = achieveRate + '%'
        document.getElementById('contractProgress').style.width = achieveRate + '%'

        const rateEl = document.getElementById('rateStatus')
        if (currentRate >= 5) { rateEl.textContent = '🎯 목표 달성!'; rateEl.style.cssText = 'background:#1a3a1a;color:#22c55e;padding:4px 12px;border-radius:20px;' }
        else if (currentRate >= 3) { rateEl.textContent = '📈 순항중'; rateEl.style.cssText = 'background:#3a2e1a;color:#f59e0b;padding:4px 12px;border-radius:20px;' }
        else { rateEl.textContent = '💪 분발 필요'; rateEl.style.cssText = 'background:#3a1a1a;color:#ef4444;padding:4px 12px;border-radius:20px;' }
      }

      const stages = ['신규', '상담중', '미팅준비', '계약검토', '완료', '보류']
      const max = Math.max(...stages.map(s => allLeads.filter(l => l.status === s).length), 1)

      if (document.getElementById('stageChart')) {
        document.getElementById('stageChart').innerHTML = stages.map(s => {
          const cnt = allLeads.filter(l => l.status === s).length; const pct = Math.round((cnt / max) * 100)
          const [, color] = (statusColors[s] || '#1f1f1f|#6b7280').split('|')
          return `<div><div class="flex justify-between text-xs mb-1"><span class="text-gray-400">${s}</span><span class="text-gray-500">${cnt}</span></div><div class="h-1.5 rounded-full" style="background:#1a1a1a"><div class="h-1.5 rounded-full" style="width:${pct}%;background:${color}"></div></div></div>`
        }).join('')
      }

      if (document.getElementById('funnelChart')) {
        const funnelStages = [
          { label: '전체', key: null, color: '#3b82f6' }, { label: '상담', key: ['상담중', '미팅준비', '계약검토', '완료'], color: '#f59e0b' },
          { label: '미팅', key: ['미팅준비', '계약검토', '완료'], color: '#f97316' }, { label: '검토', key: ['계약검토', '완료'], color: '#a855f7' },
          { label: '완료', key: ['완료'], color: '#22c55e' }
        ]
        document.getElementById('funnelChart').innerHTML = funnelStages.map((f, i) => {
          const cnt = f.key ? allLeads.filter(l => f.key.includes(l.status)).length : total
          const pct = total > 0 ? Math.round((cnt / total) * 100) : 0
          return `<div><div class="flex justify-between text-xs mb-1"><span class="text-gray-400">${f.label}</span><span class="text-gray-500">${cnt}건${i > 0 ? ' (' + pct + '%)' : ''}</span></div><div class="h-2 rounded-full" style="background:#1a1a1a"><div class="h-2 rounded-full" style="width:${i === 0 ? 100 : pct}%;background:${f.color}"></div></div></div>`
        }).join('')
      }

      if (document.getElementById('sourceChart')) {
        const sources = {}; allLeads.forEach(l => { const s = l.source || '미분류'; sources[s] = (sources[s] || 0) + 1 })
        const sortedSources = Object.entries(sources).sort((a, b) => b[1] - a[1]); const maxSource = sortedSources[0]?.[1] || 1
        document.getElementById('sourceChart').innerHTML = sortedSources.length
          ? sortedSources.map(([src, cnt]) => `<div><div class="flex justify-between text-xs mb-1"><span class="text-gray-400">${src}</span><span class="text-gray-500">${cnt}건</span></div><div class="h-1.5 rounded-full" style="background:#1a1a1a"><div class="h-1.5 rounded-full bg-blue-500" style="width:${Math.round((cnt / maxSource) * 100)}%"></div></div></div>`).join('')
          : '<p class="text-xs text-gray-600">데이터 없음</p>'
      }

      if (document.getElementById('overdueList')) {
        const overdueLeads = allLeads.filter(l => l.next_contact_at && new Date(l.next_contact_at) < now && l.status !== '완료').slice(0, 5)
        document.getElementById('overdueCount').textContent = overdueLeads.length + '건'
        document.getElementById('overdueList').innerHTML = overdueLeads.length
          ? overdueLeads.map(l => { const days = Math.floor((now - new Date(l.next_contact_at)) / (1000 * 60 * 60 * 24)); return `<div onclick="openDetail('${l.id}')" class="p-2.5 rounded-lg cursor-pointer hover:bg-gray-900 transition" style="border:1px solid #2a1a1a;"><div class="flex items-center justify-between"><span class="text-xs font-medium">${l.name || '-'}</span><span class="text-xs text-red-400">${days}일 경과</span></div><p class="text-xs text-gray-600 mt-0.5">${l.contact || '-'}</p></div>` }).join('')
          : '<p class="text-xs text-gray-600 text-center py-4">재접촉 대기 없음 👍</p>'
      }

      if (document.getElementById('recentLeads')) {
        document.getElementById('recentLeads').innerHTML = allLeads.slice(0, 5).map(l => `
        <div class="lead-row flex items-center gap-4 px-3 py-2.5 rounded-lg" onclick="openDetail('${l.id}')" style="border-bottom:1px solid #111">
          <span class="font-medium text-sm w-24 truncate">${l.name || '-'}</span>
          <span class="text-xs text-gray-500 w-28 truncate">${l.contact || '-'}</span>
          <span class="text-xs text-gray-500 w-20 truncate">${l.region || '-'}</span>
          <span class="text-xs text-gray-500 flex-1">${l.source || '-'}</span>
          ${getBadge(l.status)}
        </div>`).join('') || '<p class="text-xs text-gray-600 py-4 text-center">리드가 없습니다</p>'
      }

      renderBrandDashboard()
    }

    function renderBrandDashboard() {
      const container = document.getElementById('brandDashboard')
      if (!container) return
      const now = new Date()
      container.innerHTML = allBrands.map(b => {
        const bLeads = allLeads.filter(l => l.brand_id === b.id)
        const total = bLeads.length
        const done = bLeads.filter(l => l.status === '완료').length
        const inProgress = bLeads.filter(l => ['상담중', '미팅준비', '계약검토'].includes(l.status)).length
        const rejected = bLeads.filter(l => l.status === '보류').length
        const newLeads = bLeads.filter(l => l.status === '신규').length
        const rate = total > 0 ? ((done / total) * 100).toFixed(1) : 0
        const overdue = bLeads.filter(l => l.next_contact_at && new Date(l.next_contact_at) < now && l.status !== '완료').length
        const achieveRate = Math.min(100, Math.round((rate / 5) * 100))

        let statusIcon = '✅', statusColor = '#22c55e', statusText = '정상'
        if (overdue > 0) { statusIcon = '⚠️'; statusColor = '#f59e0b'; statusText = `재접촉 ${overdue}건` }
        if (rejected >= total * 0.3 && total > 0) { statusIcon = '🔴'; statusColor = '#ef4444'; statusText = '주의 필요' }
        if (total === 0) { statusIcon = '⬜'; statusColor = '#6b7280'; statusText = '리드 없음' }

        return `<div class="card p-5 cursor-pointer hover:border-gray-600 transition" onclick="changeBrand('${b.id}');showScreen('leads')">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style="background:${b.color}">${b.name[0]}</div>
            <div><p class="font-medium text-sm">${b.name}</p><p class="text-xs" style="color:${statusColor}">${statusIcon} ${statusText}</p></div>
          </div>
          <span class="text-xs text-gray-600">→</span>
        </div>
        <div class="grid grid-cols-4 gap-2 mb-3">
          <div class="text-center p-2 rounded-lg" style="background:#0d0d0d"><p class="text-lg font-bold">${total}</p><p class="text-xs text-gray-500">전체</p></div>
          <div class="text-center p-2 rounded-lg" style="background:#0d0d0d"><p class="text-lg font-bold text-blue-400">${inProgress}</p><p class="text-xs text-gray-500">진행</p></div>
          <div class="text-center p-2 rounded-lg" style="background:#0d0d0d"><p class="text-lg font-bold text-green-400">${done}</p><p class="text-xs text-gray-500">완료</p></div>
          <div class="text-center p-2 rounded-lg" style="background:#0d0d0d"><p class="text-lg font-bold text-gray-400">${rejected}</p><p class="text-xs text-gray-500">보류</p></div>
        </div>
        <div>
          <div class="flex justify-between text-xs mb-1"><span class="text-gray-500">전환율</span><span style="color:${rate >= 5 ? '#22c55e' : rate >= 3 ? '#f59e0b' : '#ef4444'}">${rate}% / 목표 5%</span></div>
          <div class="h-1.5 rounded-full" style="background:#1a1a1a"><div class="h-1.5 rounded-full" style="width:${achieveRate}%;background:${rate >= 5 ? '#22c55e' : rate >= 3 ? '#f59e0b' : '#ef4444'}"></div></div>
        </div>
        ${newLeads > 0 ? `<p class="text-xs text-blue-400 mt-2">🆕 신규 ${newLeads}건 대기</p>` : ''}
        ${overdue > 0 ? `<p class="text-xs text-yellow-400 mt-1">⏰ 재접촉 ${overdue}건 지연</p>` : ''}
      </div>`
      }).join('') || '<p class="text-xs text-gray-600 col-span-3 text-center py-4">등록된 브랜드가 없습니다</p>'
    }

    // ===== 모바일 렌더 =====
    function renderMobileHome() {
      const now = new Date()
      const total = allLeads.length
      const done = allLeads.filter(l => l.status === '완료').length
      const newThisMonth = allLeads.filter(l => { const d = new Date(l.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() }).length
      const overdue = allLeads.filter(l => l.next_contact_at && new Date(l.next_contact_at) < now && l.status !== '완료').length
      const targetContract = Math.max(1, Math.round(total * 0.05))
      const achieveRate = Math.min(100, Math.round((done / targetContract) * 100))

      if (document.getElementById('mKpiTotal')) document.getElementById('mKpiTotal').textContent = total
      if (document.getElementById('mKpiNew')) document.getElementById('mKpiNew').textContent = newThisMonth
      if (document.getElementById('mKpiDone')) document.getElementById('mKpiDone').textContent = done
      if (document.getElementById('mKpiOverdue')) document.getElementById('mKpiOverdue').textContent = overdue
      if (document.getElementById('mAchieve')) document.getElementById('mAchieve').textContent = achieveRate + '%'

      // 긴급 배너
      const urgentBanner = document.getElementById('mobileUrgentBanner')
      if (overdue > 0 && urgentBanner) {
        urgentBanner.classList.remove('hidden')
        document.getElementById('mobileUrgentText').textContent = `${overdue}명에게 연락이 필요해요`
      }

      // 단계별 차트
      const stages = ['신규', '상담중', '미팅준비', '계약검토', '완료', '보류']
      const max = Math.max(...stages.map(s => allLeads.filter(l => l.status === s).length), 1)
      if (document.getElementById('mStageChart')) {
        document.getElementById('mStageChart').innerHTML = stages.map(s => {
          const cnt = allLeads.filter(l => l.status === s).length; const pct = Math.round((cnt / max) * 100)
          const [, color] = (statusColors[s] || '#1f1f1f|#6b7280').split('|')
          return `<div><div class="flex justify-between text-xs mb-1"><span class="text-gray-400">${s}</span><span style="color:${color};font-weight:500;">${cnt}건</span></div><div class="h-2 rounded-full" style="background:#1a1a1a"><div class="h-2 rounded-full" style="width:${pct}%;background:${color}"></div></div></div>`
        }).join('')
      }

      // 오늘 재접촉 대기
      const todayList = allLeads.filter(l => l.next_contact_at && new Date(l.next_contact_at) < now && l.status !== '완료').slice(0, 5)
      if (document.getElementById('mTodayList')) {
        document.getElementById('mTodayList').innerHTML = todayList.length
          ? todayList.map(l => {
            const days = Math.floor((now - new Date(l.next_contact_at)) / (1000 * 60 * 60 * 24))
            return `<div onclick="openMobileDetail('${l.id}')" style="background:#0d0d0d;border:1px solid #2a1a1a;border-radius:10px;padding:10px;display:flex;align-items:center;justify-content:space-between;">
              <div>
                <p style="font-size:13px;font-weight:600;">${l.name || '-'}</p>
                <p style="font-size:11px;color:#9ca3af;">${l.contact || '-'}</p>
              </div>
              <div style="text-align:right;">
                <p style="font-size:11px;color:#ef4444;">${days}일 경과</p>
                <a href="tel:${l.contact}" style="font-size:11px;color:#22c55e;" onclick="event.stopPropagation()">📞 전화</a>
              </div>
            </div>`
          }).join('')
          : '<p style="font-size:12px;color:#6b7280;text-align:center;padding:12px;">오늘 재접촉 대기 없음 👍</p>'
      }
    }

    function renderMobileLeads(leads) {
      if (!document.getElementById('mobileLeadsList')) return
      document.getElementById('mobileLeadsList').innerHTML = leads.length
        ? leads.map(l => {
          const [bg, color] = (statusColors[l.status] || '#1f1f1f|#6b7280').split('|')
          const brand = allBrands.find(b => b.id === l.brand_id)
          return `<div onclick="openMobileDetail('${l.id}')" style="background:#111;border:1px solid #1f1f1f;border-radius:14px;padding:14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <p style="font-size:15px;font-weight:600;">${l.name || '-'}</p>
              <span style="background:${bg};color:${color};border-radius:6px;font-size:11px;padding:2px 8px;font-weight:500;">${l.status}</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
              <p style="font-size:13px;color:#9ca3af;">${l.contact || '연락처 없음'}</p>
              ${l.region ? `<p style="font-size:12px;color:#6b7280;">📍${l.region}</p>` : ''}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;gap:8px;">
                ${l.source ? `<span style="font-size:11px;color:#6b7280;">${l.source}</span>` : ''}
                ${brand ? `<span style="font-size:11px;color:${brand.color};">· ${brand.name}</span>` : ''}
              </div>
              <div style="display:flex;gap:6px;" onclick="event.stopPropagation()">
                ${l.contact ? `<a href="tel:${l.contact}" style="background:#1a3a1a;color:#22c55e;border-radius:8px;padding:4px 10px;font-size:11px;">📞</a>` : ''}
                ${l.contact ? `<a href="sms:${l.contact}" style="background:#1e3a5f;color:#3b82f6;border-radius:8px;padding:4px 10px;font-size:11px;">💬</a>` : ''}
              </div>
            </div>
          </div>`
        }).join('')
        : '<p style="font-size:13px;color:#6b7280;text-align:center;padding:32px;">리드가 없습니다</p>'
    }

    function mobileFilterLeads(status) {
      document.querySelectorAll('.mobile-stage-btn').forEach(b => {
        b.style.background = '#1a1a1a'; b.style.color = '#6b7280'; b.style.borderColor = '#2a2a2a'
      })
      event.target.style.background = '#1e3a5f'; event.target.style.color = '#3b82f6'; event.target.style.borderColor = '#3b82f6'
      renderMobileLeads(status === '전체' ? allLeads : allLeads.filter(l => l.status === status))
    }

    function mobileSearchLeads() {
      const q = document.getElementById('mobileSearchInput').value.toLowerCase()
      renderMobileLeads(allLeads.filter(l => (l.name || '').toLowerCase().includes(q) || (l.contact || '').includes(q)))
    }

    function toggleMobileSearch() {
      const bar = document.getElementById('mobileSearchBar')
      bar.classList.toggle('hidden')
      if (!bar.classList.contains('hidden')) document.getElementById('mobileSearchInput').focus()
    }

    async function openMobileDetail(id) {
      currentLead = allLeads.find(l => l.id === id)
      if (!currentLead) return

      document.getElementById('mDetailAvatar').textContent = (currentLead.name || '?')[0]
      document.getElementById('mDetailName').textContent = currentLead.name || '-'
      document.getElementById('mDetailBadge').innerHTML = getBadge(currentLead.status)
      document.getElementById('mDetailRegion').textContent = currentLead.region || '-'
      document.getElementById('mDetailSource').textContent = currentLead.source || '-'
      document.getElementById('mDetailBudget').textContent = currentLead.budget ? Number(currentLead.budget).toLocaleString() + '원' : '-'
      document.getElementById('mDetailCreated').textContent = new Date(currentLead.created_at).toLocaleDateString('ko-KR')

      if (currentLead.contact) {
        document.getElementById('mCallBtn').href = `tel:${currentLead.contact}`
        document.getElementById('mSmsBtn').href = `sms:${currentLead.contact}`
      }

      if (currentLead.next_contact_at) document.getElementById('mNextContactDate').value = currentLead.next_contact_at.split('T')[0]

      document.getElementById('mStageButtons').innerHTML = ['신규', '상담중', '미팅준비', '계약검토', '완료', '보류'].map(s => {
        const [bg, color] = (statusColors[s] || '#1f1f1f|#6b7280').split('|')
        const isActive = s === currentLead.status
        return `<button onclick="updateStatusDetail('${s}')" style="background:${isActive ? bg : '#1a1a1a'};color:${isActive ? color : '#6b7280'};border:1px solid ${isActive ? color : '#2a2a2a'};border-radius:20px;padding:5px 12px;font-size:11px;white-space:nowrap;">${isActive ? '✓ ' : ''}${s}</button>`
      }).join('')

      await loadLogs()
      showMobileScreen('detail')
    }

    async function saveMobileNextContact() {
      const date = document.getElementById('mNextContactDate').value
      if (!date || !currentLead) return
      await sb.from('leads').update({ next_contact_at: date }).eq('id', currentLead.id)
      alert('저장됐어요!'); await loadLeads()
    }

    // ===== 공통 리드 함수 =====
    function renderLeadsTable(leads) {
      if (!document.getElementById('leadsTable')) return
      document.getElementById('leadsTable').innerHTML = leads.length
        ? leads.map(l => `
        <tr class="lead-row" onclick="openDetail('${l.id}')" style="border-bottom:1px solid #111">
          <td class="px-5 py-3 text-sm font-medium">${l.name || '-'}</td>
          <td class="px-5 py-3 text-xs text-gray-400">${l.contact || '-'}</td>
          <td class="px-5 py-3 text-xs text-gray-400">${l.region || '-'}</td>
          <td class="px-5 py-3 text-xs text-gray-400">${l.source || '-'}</td>
          <td class="px-5 py-3 text-xs text-gray-400">${l.budget ? Number(l.budget).toLocaleString() + '원' : '-'}</td>
          <td class="px-5 py-3">${getBadge(l.status)}</td>
          <td class="px-5 py-3" onclick="event.stopPropagation()">
            <select onchange="updateStatus('${l.id}',this.value)" class="text-xs bg-transparent border border-gray-800 rounded px-2 py-1 text-gray-400">
              ${['신규', '상담중', '미팅준비', '계약검토', '완료', '보류'].map(s => `<option value="${s}" ${s === l.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <button onclick="event.stopPropagation();deleteLead('${l.id}')" class="ml-2 text-xs text-red-400 hover:text-red-300">삭제</button>
          </td>
        </tr>`).join('')
        : `<tr><td colspan="7" class="px-5 py-10 text-center text-xs text-gray-600">리드가 없습니다</td></tr>`
    }

    function renderPipeline() {
      const stages = ['신규', '상담중', '미팅준비', '계약검토', '완료', '보류']
      stages.forEach(s => {
        const el = document.getElementById('pipe-' + s); if (!el) return
        const leads = allLeads.filter(l => l.status === s)
        document.getElementById('pipe-count-' + s).textContent = leads.length
        el.innerHTML = leads.map(l => `
        <div draggable="true" ondragstart="dragLeadId='${l.id}'" onclick="openDetail('${l.id}')"
          class="card p-3 cursor-pointer hover:border-gray-600 transition" style="border-radius:10px;">
          <p class="text-sm font-medium mb-1">${l.name || '-'}</p>
          ${l.contact ? `<p class="text-xs text-gray-500">📞 ${l.contact}</p>` : ''}
          ${l.region ? `<p class="text-xs text-gray-500">📍 ${l.region}</p>` : ''}
          ${l.source ? `<p class="text-xs text-gray-600">📢 ${l.source}</p>` : ''}
          ${l.budget ? `<p class="text-xs text-gray-600 mt-1">💰 ${Number(l.budget).toLocaleString()}원</p>` : ''}
          <p class="text-xs text-gray-700 mt-2 pt-2" style="border-top:1px solid #1f1f1f">${new Date(l.created_at).toLocaleDateString('ko-KR')}</p>
        </div>`).join('') || `<p class="text-xs text-gray-700 text-center py-6">없음</p>`
      })
    }

    async function dropLead(event, newStatus) {
      event.preventDefault()
      if (!dragLeadId) return
      const lead = allLeads.find(l => l.id === dragLeadId)
      if (!lead || lead.status === newStatus) return
      await sb.from('leads').update({ status: newStatus }).eq('id', dragLeadId)
      await sb.from('lead_logs').insert({ lead_id: dragLeadId, status_changed_to: newStatus, note: `파이프라인 이동: ${lead.status}→${newStatus}` })
      dragLeadId = null; await loadLeads()
    }

    async function openDetail(id) {
      currentLead = allLeads.find(l => l.id === id)
      if (!currentLead) return
      document.getElementById('detailAvatar').textContent = (currentLead.name || '?')[0]
      document.getElementById('detailName').textContent = currentLead.name || '-'
      document.getElementById('detailBadge').innerHTML = getBadge(currentLead.status)
      document.getElementById('detailContact').textContent = currentLead.contact || '-'
      document.getElementById('detailRegion').textContent = currentLead.region || '-'
      document.getElementById('detailSource').textContent = currentLead.source || '-'
      document.getElementById('detailBudget').textContent = currentLead.budget ? Number(currentLead.budget).toLocaleString() + '원' : '-'
      document.getElementById('detailCreated').textContent = new Date(currentLead.created_at).toLocaleDateString('ko-KR')
      if (currentLead.contact) {
        document.getElementById('callBtn').href = `tel:${currentLead.contact}`
        document.getElementById('smsBtn').href = `sms:${currentLead.contact}`
      }
      if (currentLead.next_contact_at) document.getElementById('nextContactDate').value = currentLead.next_contact_at.split('T')[0]
      document.getElementById('stageButtons').innerHTML = ['신규', '상담중', '미팅준비', '계약검토', '완료', '보류'].map(s => {
        const [bg, color] = (statusColors[s] || '#1f1f1f|#6b7280').split('|'); const isActive = s === currentLead.status
        return `<button onclick="updateStatusDetail('${s}')" class="w-full text-left text-xs px-3 py-2 rounded-lg transition" style="background:${isActive ? bg : '#1a1a1a'};color:${isActive ? color : '#6b7280'};border:1px solid ${isActive ? color : '#2a2a2a'}">${isActive ? '✓ ' : ''}${s}</button>`
      }).join('')
      await loadLogs()
      showScreen('detail')
      document.getElementById('backBtn').classList.remove('hidden')
    }

    async function loadLogs() {
      const target = isMobile() ? 'mLogList' : 'logList'
      if (!document.getElementById(target)) return
      const { data } = await sb.from('lead_logs').select('*').eq('lead_id', currentLead.id).order('created_at', { ascending: false })
      const logs = data || []
      const resultColors = { '연결됨': '#3b82f6', '부재중': '#f59e0b', '거절': '#ef4444', '긍정': '#22c55e', '보류': '#6b7280' }
      document.getElementById(target).innerHTML = logs.length
        ? logs.map(log => `
        <div class="log-item mb-3" style="border-color:${resultColors[log.contact_result] || '#1f1f1f'}">
          <div class="flex items-center gap-2 mb-1">
            ${log.contact_result ? `<span class="text-xs font-medium" style="color:${resultColors[log.contact_result]}">${log.contact_result}</span>` : ''}
            ${log.status_changed_to ? `<span class="text-xs text-gray-600">→ ${log.status_changed_to}</span>` : ''}
            <span class="text-xs text-gray-600 ml-auto">${new Date(log.created_at).toLocaleDateString('ko-KR')}</span>
          </div>
          ${log.note ? `<p class="text-xs text-gray-400">${log.note}</p>` : ''}
        </div>`).join('')
        : '<p class="text-xs text-gray-600">활동 기록이 없습니다</p>'
    }

    function setResult(result) {
      selectedResult = result
      document.querySelectorAll('.result-btn').forEach(b => { b.style.borderColor = '#374151'; b.style.color = '#9ca3af' })
      event.target.style.borderColor = '#3b82f6'; event.target.style.color = '#3b82f6'
    }

    async function addLog() {
      if (!currentLead) return
      const note = document.getElementById('logNote').value
      if (!note && !selectedResult) return alert('결과 또는 메모를 입력해주세요')
      await sb.from('lead_logs').insert({ lead_id: currentLead.id, contact_result: selectedResult || null, note: note || null })
      document.getElementById('logNote').value = ''; selectedResult = ''
      document.querySelectorAll('.result-btn').forEach(b => { b.style.borderColor = '#374151'; b.style.color = '#9ca3af' })
      await loadLogs()
    }

    async function updateStatus(id, status) { await sb.from('leads').update({ status }).eq('id', id); await loadLeads() }

    async function updateStatusDetail(status) {
      if (!currentLead) return
      await sb.from('leads').update({ status }).eq('id', currentLead.id)
      await sb.from('lead_logs').insert({ lead_id: currentLead.id, status_changed_to: status, note: `단계 변경: ${currentLead.status}→${status}` })
      currentLead.status = status; await loadLeads()
      if (isMobile()) openMobileDetail(currentLead.id)
      else openDetail(currentLead.id)
    }

    async function saveNextContact() {
      const date = document.getElementById('nextContactDate').value
      if (!date) return
      await sb.from('leads').update({ next_contact_at: date }).eq('id', currentLead.id)
      alert('저장됐어요!'); await loadLeads()
    }

    async function deleteLead(id) {
      if (!confirm('정말 삭제할까요?')) return
      await sb.from('lead_logs').delete().eq('lead_id', id)
      await sb.from('leads').delete().eq('id', id)
      await loadLeads()
    }

    function filterLeads(status) {
      document.querySelectorAll('.stage-btn').forEach(b => { b.classList.remove('border-blue-600', 'text-blue-400'); b.classList.add('border-gray-800', 'text-gray-400') })
      event.target.classList.add('border-blue-600', 'text-blue-400'); event.target.classList.remove('border-gray-800', 'text-gray-400')
      renderLeadsTable(status === '전체' ? allLeads : allLeads.filter(l => l.status === status))
    }

    function searchLeads() {
      const q = document.getElementById('searchInput').value.toLowerCase()
      renderLeadsTable(allLeads.filter(l => (l.name || '').toLowerCase().includes(q) || (l.contact || '').includes(q) || (l.region || '').toLowerCase().includes(q)))
    }

    function goBack() { showScreen('leads'); document.getElementById('backBtn').classList.add('hidden') }

    // ===== 화면 전환 =====
    function showScreen(name) {
      ['dashboard', 'leads', 'detail', 'pipeline', 'brands', 'team', 'upload'].forEach(s => {
        document.getElementById('screen' + s.charAt(0).toUpperCase() + s.slice(1))?.classList.add('hidden')
        document.getElementById('nav-' + s)?.classList.remove('active')
        document.getElementById('nav-' + s)?.classList.add('text-gray-400')
      })
      document.getElementById('screen' + name.charAt(0).toUpperCase() + name.slice(1))?.classList.remove('hidden')
      document.getElementById('nav-' + name)?.classList.add('active')
      document.getElementById('nav-' + name)?.classList.remove('text-gray-400')
      const titles = { dashboard: '대시보드', leads: '리드 관리', detail: '리드 상세', pipeline: '파이프라인', brands: '브랜드 관리', team: '팀 관리', upload: 'DB 업로드' }
      if (document.getElementById('pageTitle')) document.getElementById('pageTitle').textContent = titles[name] || ''
      if (name !== 'detail' && document.getElementById('backBtn')) document.getElementById('backBtn').classList.add('hidden')
    }

    function showMobileScreen(name) {
      const screens = ['home', 'leads', 'detail', 'pipeline', 'more', 'brands', 'team', 'upload']
      screens.forEach(s => {
        const el = document.getElementById('mobileScreen' + s.charAt(0).toUpperCase() + s.slice(1))
        if (el) el.classList.add('hidden')
      })
      const target = document.getElementById('mobileScreen' + name.charAt(0).toUpperCase() + name.slice(1))
      if (target) target.classList.remove('hidden')

      const tabs = ['home', 'leads', 'pipeline', 'more']
      tabs.forEach(t => {
        const btn = document.getElementById('mtab-' + t)
        if (btn) btn.style.color = t === name ? '#3b82f6' : '#6b7280'
      })

      const pageNames = { home: '홈', leads: '리드 관리', detail: '리드 상세', pipeline: '파이프라인', more: '더보기', brands: '브랜드', team: '팀 관리', upload: 'DB 업로드' }
      if (document.getElementById('mobilePage')) document.getElementById('mobilePage').textContent = pageNames[name] || ''

      // 파이프라인 모바일에서도 보이게
      if (name === 'pipeline') renderPipeline()
    }

    // ===== 파일 업로드 =====
    const colMap = { name: ['이름', '성함', 'name', '성명', '고객명'], contact: ['연락처', '전화', '핸드폰', '휴대폰', 'phone', 'tel', '전화번호'], region: ['지역', '희망지역', '지점', '희망상권', '지역명'], budget: ['예산', '투자금', '투자예산', '자본금'], source: ['유입경로', '채널', '매체', '출처', '광고채널'] }
    let parsedLeads = []

    function handleDrop(e) { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) processFile(file, 'uploadBrandId', 'previewCount', 'previewHead', 'previewBody', 'previewSection', 'uploadResult') }
    function handleFile(e) { const file = e.target.files[0]; if (file) processFile(file, 'uploadBrandId', 'previewCount', 'previewHead', 'previewBody', 'previewSection', 'uploadResult') }
    function handleMobileFile(e) { const file = e.target.files[0]; if (file) processFile(file, 'mUploadBrandId', 'mPreviewCount', 'mPreviewHead', 'mPreviewBody', 'mPreviewSection', 'mUploadResult') }

    function processFile(file, brandElId, countElId, headElId, bodyElId, previewElId, resultElId) {
      const ext = file.name.split('.').pop().toLowerCase(); const reader = new FileReader()
      if (ext === 'csv') { reader.onload = (e) => parseCSV(e.target.result, brandElId, countElId, headElId, bodyElId, previewElId, resultElId); reader.readAsText(file, 'UTF-8') }
      else if (ext === 'xlsx' || ext === 'xls') {
        reader.onload = (e) => { const data = new Uint8Array(e.target.result); const wb = XLSX.read(data, { type: 'array' }); parseCSV(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]), brandElId, countElId, headElId, bodyElId, previewElId, resultElId) }
        reader.readAsArrayBuffer(file)
      } else alert('CSV 또는 엑셀 파일만 가능합니다')
    }

    function parseCSV(text, brandElId, countElId, headElId, bodyElId, previewElId, resultElId) {
      const lines = text.trim().split('\n'); if (lines.length < 2) return alert('데이터가 없습니다')
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const mapping = {}; headers.forEach((h, i) => { for (const [field, aliases] of Object.entries(colMap)) { if (aliases.some(a => h.includes(a))) mapping[field] = i } })
      const brandId = document.getElementById(brandElId)?.value || null
      parsedLeads = lines.slice(1).filter(l => l.trim()).map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
        return { name: mapping.name !== undefined ? cols[mapping.name] : null, contact: mapping.contact !== undefined ? cols[mapping.contact] : null, region: mapping.region !== undefined ? cols[mapping.region] : null, budget: mapping.budget !== undefined ? (parseInt(cols[mapping.budget].replace(/[^0-9]/g, '')) || null) : null, source: mapping.source !== undefined ? cols[mapping.source] : null, status: '신규', brand_id: brandId }
      }).filter(l => l.name)
      if (!parsedLeads.length) return alert('이름 컬럼을 찾을 수 없습니다')
      document.getElementById(countElId).textContent = parsedLeads.length + '건'
      document.getElementById(headElId).innerHTML = `<tr style="border-bottom:1px solid #1f1f1f"><th class="text-left px-3 py-2 text-gray-500">이름</th><th class="text-left px-3 py-2 text-gray-500">연락처</th><th class="text-left px-3 py-2 text-gray-500">지역</th><th class="text-left px-3 py-2 text-gray-500">채널</th></tr>`
      document.getElementById(bodyElId).innerHTML = parsedLeads.slice(0, 5).map(l => `<tr style="border-bottom:1px solid #111"><td class="px-3 py-2 text-gray-300">${l.name || '-'}</td><td class="px-3 py-2 text-gray-400">${l.contact || '-'}</td><td class="px-3 py-2 text-gray-400">${l.region || '-'}</td><td class="px-3 py-2 text-gray-400">${l.source || '-'}</td></tr>`).join('')
      document.getElementById(previewElId).classList.remove('hidden')
      document.getElementById(resultElId).classList.add('hidden')
    }

    async function uploadLeads() {
      if (!parsedLeads.length) return
      const { error } = await sb.from('leads').insert(parsedLeads)
      if (error) { alert('오류: ' + error.message); return }
      const resultIds = ['uploadResult', 'mUploadResult']
      resultIds.forEach(id => { const el = document.getElementById(id); if (el) { el.textContent = `✅ ${parsedLeads.length}건 등록 완료!`; el.classList.remove('hidden') } })
      const previewIds = ['previewSection', 'mPreviewSection']
      previewIds.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden') })
      parsedLeads = []; await loadLeads()
    }

    function clearUpload() { parsedLeads = []; document.getElementById('previewSection')?.classList.add('hidden'); document.getElementById('fileInput').value = '' }

    function exportExcel() {
      if (!allLeads.length) return alert('내보낼 데이터가 없습니다')
      const rows = allLeads.map(l => {
        const brand = allBrands.find(b => b.id === l.brand_id)
        return { '브랜드': brand ? brand.name : '', '이름': l.name || '', '연락처': l.contact || '', '지역': l.region || '', '채널': l.source || '', '예산': l.budget || '', '단계': l.status || '', '재접촉일': l.next_contact_at ? l.next_contact_at.split('T')[0] : '', '유입일': l.created_at ? new Date(l.created_at).toLocaleDateString('ko-KR') : '' }
      })
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '리드목록')
      XLSX.writeFile(wb, `정총무_리드_${new Date().toLocaleDateString('ko-KR').replace(/\./g, '').replace(/ /g, '')}.xlsx`)
    }

    function showAddLead() { document.getElementById('addLeadModal').classList.remove('hidden') }
    function closeAddLead() { document.getElementById('addLeadModal').classList.add('hidden') }

    async function addLead() {
      const name = document.getElementById('addName').value
      if (!name) return alert('이름을 입력해주세요')
      await sb.from('leads').insert({ name, contact: document.getElementById('addContact').value, region: document.getElementById('addRegion').value, source: document.getElementById('addSource').value, budget: document.getElementById('addBudget').value || null, status: document.getElementById('addStatus').value, brand_id: document.getElementById('addBrand').value || null })
      closeAddLead()
      document.getElementById('addName').value = ''
      document.getElementById('addContact').value = ''
      document.getElementById('addRegion').value = ''
      document.getElementById('addBudget').value = ''
      await loadLeads()
    }

    // ===== 초기화 =====
    window.addEventListener('load', () => {
      if (!checkInviteToken()) {
        sb.auth.getSession().then(({ data }) => { if (data.session) initApp(data.session.user) })
      }
    })
  