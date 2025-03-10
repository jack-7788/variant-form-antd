import { omit, isEmpty, isArray } from 'lodash-es';
import { fmtHttpParams } from '@/utils/request/fmtHttpParams';
import { TpfConfirm } from '@/hooks/TpfConfirm';

export default {
  data() {
    return {
      selectedRowInfo: { selectedRowKeys: [], selectedRows: [] },
      selectRow: {},
      loading: false
    };
  },
  computed: {
    tableHeight() {
      return this.widget.options.tableHeight || undefined;
    },
    // rowClassName() {
    //   if (this.widget.options.stripe) {
    //     return (_record, index) => (index % 2 === 1 ? 'table-striped' : null);
    //   }
    //   return null;
    // },
    customClass() {
      return this.widget.options.customClass || '';
    },
    widgetSize() {
      return this.widget.options.tableSize || 'default';
    },
    fmtPagination() {
      const { showPagination } = this.widget.options;
      if (!showPagination) return false;
      return {
        ...this.widget.options.pagination,
        showTotal: total => `共 ${total} 条`
      };
    }
  },
  methods: {
    handleHidden() {
      const { onHidden, hidden } = this.widget.options;
      if (hidden) return true;
      if (onHidden) {
        const onHiddenFn = new Function(onHidden);
        return onHiddenFn.call(this);
      }
      return false;
    },
    rowClassName(record) {
      const { rowKey, colorRow } = this.widget.options;

      if (!colorRow) return '';
      return this.selectRow[rowKey] === record[rowKey] ? 'colorRowClassName' : '';
    },
    handleResizeColumn(w, col) {
      const { tableColumns } = this.widget.options;
      const newTableColumns = tableColumns.map(item => {
        if (item.dataIndex === col.dataIndex) {
          item.width = w;
        }
        return { ...item };
      });
      this.setTableColumns(newTableColumns);
    },
    disabledClick() {
      const { hasRowSelection } = this.widget.options.rowSelection;
      if (hasRowSelection) {
        return isEmpty(this.selectedRowInfo.selectedRowKeys);
      }
      return isEmpty(this.selectRow);
    },
    getSelectedRowKeys() {
      return this.selectedRowInfo.selectedRowKeys;
    },
    getSelectedRows() {
      return this.selectedRowInfo.getSelectedRows;
    },
    getTableColumns() {
      return this.widget.options.tableColumns;
    },
    setTableColumns(list) {
      this.widget.options.tableColumns = list;
      return;
    },
    async delSelectRow(delKeys) {
      await TpfConfirm({ content: '确定删除选中的数据吗' });
      delKeys = delKeys || this.selectedRowInfo.selectedRowKeys;
      if (!delKeys.length) return;
      const { rowKey } = this.widget.options;
      const data = this.getDataSource();
      const newList = data.filter(item => !delKeys?.includes(item[rowKey]));
      this.setDataSource(newList);

      this.$message.success('操作成功');
    },

    getPagination() {
      return this.widget.options.pagination;
    },
    /**
     * 设置表格分页
     * @param pagination
     */
    setPagination(pagination) {
      if (pagination.page !== undefined) {
        this.widget.options.pagination.current = pagination.page;
      }

      if (pagination.pageSize !== undefined) {
        this.widget.options.pagination.pageSize = pagination.pageSize;
      }

      if (pagination.total !== undefined) {
        this.widget.options.pagination.total = pagination.total;
      }
    },
    setDataSource(list) {
      this.selectedRowInfo = { selectedRowKeys: [], selectedRows: [] };
      this.selectRow = {};
      const val = isArray(list) ? list : [list];
      this.widget.options.dataSource = [...val];
    },
    setValue(list) {
      console.log('list: ', list);
      this.setDataSource(list);
    },
    getDataSource() {
      return this.widget.options.dataSource;
    },
    getValue() {
      return this.getDataSource();
    },
    async loadDataTableDataSource() {
      if (!this.widget.options.dsEnabled) {
        return;
      }
      const ops = this.widget.options;
      if (ops.dsEnabled && ops.http.url) {
        this.loading = true;
        const res = await fmtHttpParams.call(this, ops);
        this.setPagination(res);
        this.setDataSource(res.list);
        this.loading = false;
      }
    },
    handleCustomRow(record) {
      const { customRow, colorRow } = this.widget.options;
      const { hasRowSelection } = this.widget.options.rowSelection;
      // if (!customRow) return {};
      return {
        onClick: event => {
          if (colorRow) {
            this.selectRow = record;
          }
          const customFn = new Function('record', 'event', customRow.onClick);
          customFn.call(this, record, event);
        },
        onDblclick: event => {
          const customFn = new Function('record', 'event', customRow.onDblclick);
          customFn.call(this, record, event);
        },
        onMouseenter: event => {
          const customFn = new Function('record', 'event', customRow.onMouseenter);
          customFn.call(this, record, event);
        },
        onMouseleave: event => {
          const customFn = new Function('record', 'event', customRow.onMouseleave);
          customFn.call(this, record, event);
        }
      };
    },
    handleColumnItem(item) {
      const res = omit(item, ['customRender']);
      const customRenderFn = item.customRender;

      if (!customRenderFn) return item;
      return {
        ...res,
        customRender: ({ text, record, index, column }) => {
          const cusFunc = new Function('text', 'record', 'index', 'column', customRenderFn);
          return cusFunc.call(this, text, record, index, column);
        }
      };
    },
    getOperationButtonLabel(buttonConfig, rowIndex, row) {
      const { onGetOperationButtonLabel } = this.widget.options;
      if (!!onGetOperationButtonLabel) {
        const customFn = new Function('buttonConfig', 'rowIndex', 'row', onGetOperationButtonLabel);
        return customFn.call(this, buttonConfig, rowIndex, row);
      } else {
        return buttonConfig.label;
      }
    },
    handleOperationButtonClick(btnName, rowIndex, row, scope, ob) {
      this.skipSelectionChangeEvent = true;
      try {
        if (ob.onClick) {
          const clcFn = new Function('record', 'index', 'column', 'btn', ob.onClick);
          clcFn.call(this, row, rowIndex, scope.column, ob);

          return;
        }

        const { onOperationButtonClick } = this.widget.options;
        if (!!onOperationButtonClick) {
          const customFn = new Function('buttonName', 'rowIndex', 'row', onOperationButtonClick);
          customFn.call(this, btnName, rowIndex, row);
        } else {
          this.dispatch('VFormRender', 'operationButtonClick', [this, btnName, rowIndex, row]);
        }
      } finally {
        this.skipSelectionChangeEvent = false;
      }
    },
    showOperationButton(buttonConfig, rowIndex, row) {
      const { onHideOperationButton } = this.widget.options;
      if (!!onHideOperationButton) {
        const customFn = new Function('buttonConfig', 'rowIndex', 'row', onHideOperationButton);
        return !!customFn.call(this, buttonConfig, rowIndex, row);
      } else {
        return !buttonConfig.hidden;
      }
    },
    disableOperationButton(buttonConfig, rowIndex, row) {
      const { onDisableOperationButton } = this.widget.options;
      if (!!onDisableOperationButton) {
        const customFn = new Function('buttonConfig', 'rowIndex', 'row', onDisableOperationButton);
        return customFn.call(this, buttonConfig, rowIndex, row);
      } else {
        return buttonConfig.disabled;
      }
    },
    customRenderIndex({ index }) {
      return index + 1;
    },
    handleCurrentPageChange(currentPage) {
      this.currentPage = currentPage;
      // if (!!this.widget.options.dsEnabled && !!this.widget.options.dsName) {
      //   this.loadDataFromDS();
      // }

      const { onCurrentPageChange } = this.widget.options;

      if (!!onCurrentPageChange) {
        const customFn = new Function('pageSize', 'currentPage', onCurrentPageChange);
        customFn.call(this, this.pageSize, currentPage);
      } else {
        this.dispatch('VFormRender', 'dataTablePageChange', [this, this.pageSize, currentPage]);
      }
    },
    handlePageSizeChange(pageSize) {
      this.pageSize = pageSize;
      // if (!!this.widget.options.dsEnabled && !!this.widget.options.dsName) {
      //   this.loadDataFromDS();
      // }
      const { onPageSizeChange } = this.widget.options;
      if (!!onPageSizeChange) {
        const customFn = new Function('pageSize', 'currentPage', onPageSizeChange);
        customFn.call(this, pageSize, this.currentPage);
      } else {
        this.dispatch('VFormRender', 'dataTablePageSizeChange', [this, pageSize, this.currentPage]);
      }
    },
    handleTablePageChange(pagination, filters, sorter, { currentDataSource }) {
      const fn = this.widget.options.onTableChange;
      this.widget.options.pagination.current = pagination.current;
      this.widget.options.pagination.pageSize = pagination.pageSize;
      if (fn) {
        const changeFunc = new Function('pagination', 'filters', 'sorter', 'currentDataSource', fn);
        changeFunc.call(this, pagination, filters, sorter, { currentDataSource });
      }
      this.loadDataTableDataSource();
    },
    handleRowSelection() {
      const info = this.widget.options.rowSelection;
      if (!info.hasRowSelection) {
        return undefined;
      }
      return {
        ...omit(info, ['onChange']),
        onChange: (selectedRowKeys, selectedRows) => {
          this.selectedRowInfo = { selectedRowKeys, selectedRows };
          const rcFunc = new Function('selectedRowKeys', 'selectedRows', info.onChange);
          rcFunc.call(this, selectedRowKeys, selectedRows);
        }
      };
    }
  }
};
