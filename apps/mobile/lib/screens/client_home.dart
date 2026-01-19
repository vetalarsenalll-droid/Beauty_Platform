import 'package:flutter/material.dart';
import '../widgets/section_header.dart';
import '../widgets/summary_grid.dart';

class ClientHome extends StatelessWidget {
  const ClientHome({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: const [
        SectionHeader(
          title: 'Личный кабинет клиента',
          subtitle: 'Записи, оплаты, избранное и лояльность.',
        ),
        SizedBox(height: 16),
        SummaryGrid(
          items: [
            SummaryItem(title: 'Мои записи', subtitle: 'Перенос и отмена'),
            SummaryItem(title: 'Оплаты', subtitle: 'Чеки и возвраты'),
            SummaryItem(title: 'Избранное', subtitle: 'Салоны и мастера'),
            SummaryItem(title: 'Лояльность', subtitle: 'Баланс и уровни'),
          ],
        ),
      ],
    );
  }
}
