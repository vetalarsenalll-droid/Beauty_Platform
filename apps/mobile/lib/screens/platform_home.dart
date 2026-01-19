import 'package:flutter/material.dart';
import '../api_client.dart';
import '../platform_api.dart';
import '../widgets/section_header.dart';
import '../widgets/summary_grid.dart';

enum PlatformSection {
  overview,
  accounts,
  plans,
  moderation,
  monitoring,
  audit,
  settings,
}

class PlatformSectionItem {
  final PlatformSection section;
  final String label;
  final IconData icon;

  const PlatformSectionItem({
    required this.section,
    required this.label,
    required this.icon,
  });
}

const List<PlatformSectionItem> platformSections = [
  PlatformSectionItem(
    section: PlatformSection.overview,
    label: 'Обзор',
    icon: Icons.space_dashboard_outlined,
  ),
  PlatformSectionItem(
    section: PlatformSection.accounts,
    label: 'Аккаунты',
    icon: Icons.storefront_outlined,
  ),
  PlatformSectionItem(
    section: PlatformSection.plans,
    label: 'Тарифы',
    icon: Icons.credit_card_outlined,
  ),
  PlatformSectionItem(
    section: PlatformSection.moderation,
    label: 'Модерация',
    icon: Icons.verified_outlined,
  ),
  PlatformSectionItem(
    section: PlatformSection.monitoring,
    label: 'Мониторинг',
    icon: Icons.monitor_heart_outlined,
  ),
  PlatformSectionItem(
    section: PlatformSection.audit,
    label: 'Аудит',
    icon: Icons.fact_check_outlined,
  ),
  PlatformSectionItem(
    section: PlatformSection.settings,
    label: 'Настройки',
    icon: Icons.tune_outlined,
  ),
];

class PlatformSectionView extends StatelessWidget {
  final PlatformSection section;
  final ValueChanged<PlatformSection> onNavigate;
  final String token;

  const PlatformSectionView({
    super.key,
    required this.section,
    required this.onNavigate,
    required this.token,
  });

  @override
  Widget build(BuildContext context) {
    switch (section) {
      case PlatformSection.overview:
        return _PlatformOverview(token: token, onNavigate: onNavigate);
      case PlatformSection.accounts:
        return _PlatformAccounts(token: token);
      case PlatformSection.plans:
        return _PlatformPlans(token: token);
      case PlatformSection.moderation:
        return _PlatformModeration(onNavigate: onNavigate);
      case PlatformSection.monitoring:
        return _PlatformMonitoring(onNavigate: onNavigate);
      case PlatformSection.audit:
        return _PlatformAudit();
      case PlatformSection.settings:
        return _PlatformSettings(onNavigate: onNavigate);
    }
  }
}

class _PlatformOverview extends StatefulWidget {
  const _PlatformOverview({
    required this.token,
    required this.onNavigate,
  });

  final String token;
  final ValueChanged<PlatformSection> onNavigate;

  @override
  State<_PlatformOverview> createState() => _PlatformOverviewState();
}

class _PlatformOverviewState extends State<_PlatformOverview> {
  bool _loading = true;
  String? _error;
  int? _activeAccounts;
  int? _newAccounts;
  int? _outboxLag;
  int? _alerts;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = PlatformApi(ApiClient(token: widget.token));
    final accountsResponse = await api.fetchAccounts();
    final outboxResponse = await api.fetchOutbox();

    if (accountsResponse['error'] != null || outboxResponse['error'] != null) {
      setState(() {
        _loading = false;
        _error =
            (accountsResponse['error'] ?? outboxResponse['error'])['message']
                    ?.toString() ??
                'Ошибка загрузки';
      });
      return;
    }

    final accounts = (accountsResponse['data'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    final now = DateTime.now();
    final sevenDaysAgo = now.subtract(const Duration(days: 7));

    final activeAccounts = accounts
        .where((account) => account['status']?.toString() == 'ACTIVE')
        .length;
    final newAccounts = accounts.where((account) {
      final createdAt = DateTime.tryParse(
        account['createdAt']?.toString() ?? '',
      );
      return createdAt != null && createdAt.isAfter(sevenDaysAgo);
    }).length;

    final outbox = outboxResponse['data'] as Map<String, dynamic>? ?? {};
    final recent = (outbox['recent'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    final lagMinutes = recent.isEmpty
        ? null
        : (recent
                    .map((item) {
                      final createdAt = DateTime.tryParse(
                        item['createdAt']?.toString() ?? '',
                      );
                      return createdAt == null
                          ? 0
                          : now.difference(createdAt).inMinutes;
                    })
                    .reduce((a, b) => a + b) /
                recent.length)
            .round();

    setState(() {
      _loading = false;
      _activeAccounts = activeAccounts;
      _newAccounts = newAccounts;
      _outboxLag = lagMinutes;
      _alerts = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SectionHeader(
          title: 'Панель управления платформой',
          subtitle: 'Сводка по аккаунтам, подпискам и состоянию системы.',
        ),
        const SizedBox(height: 16),
        if (_loading)
          const Center(child: CircularProgressIndicator())
        else if (_error != null)
          _EmptyStateCard(title: 'Ошибка', subtitle: _error!)
        else
          SummaryGrid(
            items: [
              SummaryItem(
                title: 'Активные аккаунты',
                subtitle: (_activeAccounts ?? 0).toString(),
              ),
              SummaryItem(
                title: 'Новые регистрации',
                subtitle: (_newAccounts ?? 0).toString(),
              ),
              SummaryItem(
                title: 'Outbox lag',
                subtitle: _outboxLag == null ? '—' : '${_outboxLag} мин',
              ),
              SummaryItem(
                title: 'Системные алерты',
                subtitle: (_alerts ?? 0).toString(),
              ),
            ],
          ),
        const SizedBox(height: 20),
        _QuickActionCard(
          title: 'Настройки платформы',
          subtitle: 'Глобальные шаблоны, справочники и лимиты.',
          onTap: () => widget.onNavigate(PlatformSection.settings),
        ),
        const SizedBox(height: 12),
        _QuickActionCard(
          title: 'Мониторинг',
          subtitle: 'Outbox, deliveries, webhooks, healthchecks.',
          onTap: () => widget.onNavigate(PlatformSection.monitoring),
        ),
        const SizedBox(height: 12),
        _QuickActionCard(
          title: 'Модерация',
          subtitle: 'Отзывы, медиа и публичные профили.',
          onTap: () => widget.onNavigate(PlatformSection.moderation),
        ),
      ],
    );
  }
}

class _PlatformAccounts extends StatefulWidget {
  const _PlatformAccounts({required this.token});

  final String token;

  @override
  State<_PlatformAccounts> createState() => _PlatformAccountsState();
}

class _PlatformAccountsState extends State<_PlatformAccounts> {
  final _nameController = TextEditingController();
  final _slugController = TextEditingController();
  final _timeZoneController = TextEditingController(text: 'Europe/Moscow');

  bool _loading = true;
  bool _saving = false;
  String? _error;
  List<dynamic> _accounts = [];
  List<dynamic> _plans = [];
  int? _selectedPlanId;

  PlatformApi get _api => PlatformApi(ApiClient(token: widget.token));

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final plansResponse = await _api.fetchPlans();
    final accountsResponse = await _api.fetchAccounts();

    if (plansResponse['error'] != null || accountsResponse['error'] != null) {
      setState(() {
        _loading = false;
        _error =
            (plansResponse['error'] ?? accountsResponse['error'])['message']
                    ?.toString() ??
                'Ошибка загрузки';
      });
      return;
    }

    setState(() {
      _loading = false;
      _plans = (plansResponse['data'] as List<dynamic>? ?? []);
      _accounts = (accountsResponse['data'] as List<dynamic>? ?? []);
    });
  }

  Future<void> _createAccount() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final response = await _api.createAccount(
      name: _nameController.text.trim(),
      slug: _slugController.text.trim(),
      timeZone: _timeZoneController.text.trim(),
      planId: _selectedPlanId,
    );

    if (response['error'] != null) {
      setState(() {
        _saving = false;
        _error = response['error']['message']?.toString() ?? 'Ошибка создания';
      });
      return;
    }

    _nameController.clear();
    _slugController.clear();
    _selectedPlanId = null;
    await _load();
    setState(() => _saving = false);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _slugController.dispose();
    _timeZoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SectionHeader(
          title: 'Управление бизнес-аккаунтами',
          subtitle: 'Статусы, лимиты, тарифы и подключенные модули.',
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Новый аккаунт',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: 'Название'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _slugController,
                  decoration: const InputDecoration(labelText: 'Slug'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _timeZoneController,
                  decoration: const InputDecoration(labelText: 'Таймзона'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<int>(
                  value: _selectedPlanId,
                  items: [
                    const DropdownMenuItem<int>(
                      value: null,
                      child: Text('Без тарифа'),
                    ),
                    ..._plans.map(
                      (plan) => DropdownMenuItem<int>(
                        value: plan['id'] as int,
                        child: Text(plan['name'].toString()),
                      ),
                    ),
                  ],
                  onChanged: (value) => setState(() => _selectedPlanId = value),
                  decoration: const InputDecoration(labelText: 'Тариф'),
                ),
                const SizedBox(height: 12),
                if (_error != null)
                  Text(
                    _error!,
                    style: const TextStyle(color: Colors.red),
                  ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: _saving ? null : _createAccount,
                  child: _saving
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Создать аккаунт'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (_loading)
          const Center(child: CircularProgressIndicator())
        else if (_accounts.isEmpty)
          const _EmptyStateCard(
            title: 'Аккаунтов пока нет',
            subtitle: 'Создайте первый бизнес-аккаунт.',
          )
        else
          Card(
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _accounts.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final account = _accounts[index] as Map<String, dynamic>;
                final plan = account['plan'] as Map<String, dynamic>?;
                return ListTile(
                  title: Text(account['name'].toString()),
                  subtitle:
                      Text('${account['slug']} · ${plan?['name'] ?? 'Без тарифа'}'),
                  trailing: Text(account['status'].toString()),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _PlatformPlans extends StatefulWidget {
  const _PlatformPlans({required this.token});

  final String token;

  @override
  State<_PlatformPlans> createState() => _PlatformPlansState();
}

class _PlatformPlansState extends State<_PlatformPlans> {
  final _nameController = TextEditingController();
  final _codeController = TextEditingController();
  final _priceController = TextEditingController();
  final _currencyController = TextEditingController(text: 'RUB');

  bool _loading = true;
  bool _saving = false;
  String? _error;
  List<dynamic> _plans = [];

  PlatformApi get _api => PlatformApi(ApiClient(token: widget.token));

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final response = await _api.fetchPlans();
    if (response['error'] != null) {
      setState(() {
        _loading = false;
        _error = response['error']['message']?.toString() ?? 'Ошибка загрузки';
      });
      return;
    }
    setState(() {
      _loading = false;
      _plans = (response['data'] as List<dynamic>? ?? []);
    });
  }

  Future<void> _createPlan() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final response = await _api.createPlan(
      name: _nameController.text.trim(),
      code: _codeController.text.trim(),
      priceMonthly: _priceController.text.trim(),
      currency: _currencyController.text.trim(),
    );
    if (response['error'] != null) {
      setState(() {
        _saving = false;
        _error = response['error']['message']?.toString() ?? 'Ошибка создания';
      });
      return;
    }

    _nameController.clear();
    _codeController.clear();
    _priceController.clear();
    await _load();
    setState(() => _saving = false);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _codeController.dispose();
    _priceController.dispose();
    _currencyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SectionHeader(
          title: 'Планы и условия платформы',
          subtitle: 'Управление тарифами, лимитами и модулями.',
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Новый тариф',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: 'Название'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _codeController,
                  decoration: const InputDecoration(labelText: 'Код'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _priceController,
                  decoration: const InputDecoration(labelText: 'Цена в месяц'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _currencyController,
                  decoration: const InputDecoration(labelText: 'Валюта'),
                ),
                const SizedBox(height: 12),
                if (_error != null)
                  Text(
                    _error!,
                    style: const TextStyle(color: Colors.red),
                  ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: _saving ? null : _createPlan,
                  child: _saving
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Создать тариф'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (_loading)
          const Center(child: CircularProgressIndicator())
        else if (_plans.isEmpty)
          const _EmptyStateCard(
            title: 'Тарифов нет',
            subtitle: 'Создайте первый тариф.',
          )
        else
          Card(
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _plans.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final plan = _plans[index] as Map<String, dynamic>;
                return ListTile(
                  title: Text(plan['name'].toString()),
                  subtitle: Text(
                    '${plan['code']} · ${plan['priceMonthly']} ${plan['currency']}',
                  ),
                  trailing: plan['isActive'] == true
                      ? const Icon(Icons.check_circle, color: Colors.green)
                      : const Icon(Icons.pause_circle, color: Colors.grey),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _PlatformModeration extends StatelessWidget {
  const _PlatformModeration({required this.onNavigate});

  final ValueChanged<PlatformSection> onNavigate;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: const [
        SectionHeader(
          title: 'Очередь модерации',
          subtitle: 'Отзывы, медиа и публичные страницы аккаунтов.',
        ),
        SizedBox(height: 16),
        _EmptyStateCard(
          title: 'Нет объектов на проверке',
          subtitle: 'Проверки появятся после подключения данных.',
        ),
      ],
    );
  }
}

class _PlatformMonitoring extends StatelessWidget {
  const _PlatformMonitoring({required this.onNavigate});

  final ValueChanged<PlatformSection> onNavigate;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SectionHeader(
          title: 'Мониторинг системы',
          subtitle: 'Состояние сервисов и очередей доставки.',
        ),
        const SizedBox(height: 16),
        _QuickActionCard(
          title: 'Outbox',
          subtitle: 'Нет данных о задержках.',
          onTap: () => onNavigate(PlatformSection.monitoring),
        ),
        const SizedBox(height: 12),
        _QuickActionCard(
          title: 'Deliveries',
          subtitle: 'Нет данных о доставках.',
          onTap: () => onNavigate(PlatformSection.monitoring),
        ),
        const SizedBox(height: 12),
        _QuickActionCard(
          title: 'Webhooks',
          subtitle: 'Нет данных о подписках.',
          onTap: () => onNavigate(PlatformSection.monitoring),
        ),
      ],
    );
  }
}

class _PlatformAudit extends StatelessWidget {
  const _PlatformAudit();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: const [
        SectionHeader(
          title: 'Аудит действий',
          subtitle: 'Журнал действий администраторов платформы.',
        ),
        SizedBox(height: 16),
        _EmptyStateCard(
          title: 'Журнал пуст',
          subtitle: 'Подключите API, чтобы видеть события.',
        ),
      ],
    );
  }
}

class _PlatformSettings extends StatelessWidget {
  const _PlatformSettings({required this.onNavigate});

  final ValueChanged<PlatformSection> onNavigate;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SectionHeader(
          title: 'Глобальные настройки',
          subtitle: 'Шаблоны, SEO-пресеты, системные справочники.',
        ),
        const SizedBox(height: 16),
        _QuickActionCard(
          title: 'Шаблоны уведомлений',
          subtitle: 'Подключите API для редактирования.',
          onTap: () => onNavigate(PlatformSection.settings),
        ),
        const SizedBox(height: 12),
        _QuickActionCard(
          title: 'SEO-пресеты',
          subtitle: 'Подключите API для редактирования.',
          onTap: () => onNavigate(PlatformSection.settings),
        ),
        const SizedBox(height: 12),
        _QuickActionCard(
          title: 'Справочники',
          subtitle: 'Подключите API для редактирования.',
          onTap: () => onNavigate(PlatformSection.settings),
        ),
      ],
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  const _QuickActionCard({
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

class _EmptyStateCard extends StatelessWidget {
  final String title;
  final String subtitle;

  const _EmptyStateCard({required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text(subtitle),
          ],
        ),
      ),
    );
  }
}
