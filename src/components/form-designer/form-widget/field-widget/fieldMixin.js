import { deepClone, translateOptionItems } from '@/utils/util';
import FormValidators from '@/utils/validators';
import { fmtHttpParams } from '@/utils/request/fmtHttpParams';
import { isArray, eq } from 'lodash-es';

export default {
  inject: [
    'refList',
    'getFormConfig',
    'globalOptionData',
    'globalModel',
    'getOptionData',
    'getGlobalDsv',
    'getReadMode',
    'getSubFormFieldFlag',
    'getSubFormName',
    'getDSResultCache'
  ],
  data() {
    return {
      fieldReadonlyFlag: false,
      loading: false
    };
  },
  computed: {
    formConfig() {
      return this.getFormConfig();
    },

    subFormName() {
      return !!this.getSubFormName ? this.getSubFormName() : '';
    },

    subFormItemFlag() {
      return !!this.getSubFormFieldFlag ? this.getSubFormFieldFlag() : false;
    },

    formModel: {
      cache: false,
      get() {
        return this.globalModel.formModel;
      }
    },

    isReadMode() {
      //return this.getReadMode() || this.fieldReadonlyFlag
      return !!this.getReadMode() ? true : this.fieldReadonlyFlag;
    },

    optionLabel() {
      if (this.fieldModel === null) {
        return '';
      } else {
        let resultContent = '';

        const { valueKey, labelKey } = this.field.options;
        this.field.options.optionItems.forEach(oItem => {
          if (
            oItem[valueKey] === this.fieldModel ||
            this.findInArray(this.fieldModel, oItem[valueKey]) !== -1
          ) {
            resultContent =
              resultContent === '' ? oItem[labelKey] : resultContent + ' ' + oItem[labelKey];
          }
        });

        return resultContent;
      }
    }
  },

  methods: {
    handleHidden() {
      if (this.designState) {
        return false;
      }
      const { onHidden, hidden } = this.field.options;
      if (hidden) return true;
      if (onHidden) {
        const onHiddenFn = new Function(onHidden);
        return onHiddenFn.call(this);
      }
      return false;
    },
    handleDisabled() {
      if (this.designState) {
        return false;
      }
      const { onDisabled, disabled } = this.field.options;
      if (disabled) return true;
      if (onDisabled) {
        const disabledFn = new Function(onDisabled);
        return disabledFn.call(this);
      }
      return false;
    },
    findInArray(arrayObject, element) {
      if (!Array.isArray(arrayObject)) {
        return -1;
      }

      let foundIdx = -1;
      arrayObject.forEach((aItem, aIdx) => {
        if (aItem === element) {
          foundIdx = aIdx;
        }
      });

      return foundIdx;
    },

    //--------------------- 组件内部方法 begin ------------------//
    getPropName() {
      if (this.subFormItemFlag && !this.designState) {
        return this.subFormName + '.' + this.subFormRowIndex + '.' + this.field.options.name + '';
      } else {
        return this.field.options.name;
      }
    },

    initFieldModel() {
      if (!this.field.formItemFlag) {
        return;
      }

      if (!!this.subFormItemFlag && !this.designState) {
        //SubForm子表单组件需要特殊处理！！
        const subFormData = this.formModel[this.subFormName];
        if (
          (subFormData === undefined ||
            subFormData[this.subFormRowIndex] === undefined ||
            subFormData[this.subFormRowIndex][this.field.options.name] === undefined) &&
          this.field.options.defaultValue !== undefined
        ) {
          this.fieldModel = this.field.options.defaultValue;
          subFormData[this.subFormRowIndex][this.field.options.name] =
            this.field.options.defaultValue;
        } else if (subFormData[this.subFormRowIndex][this.field.options.name] === undefined) {
          this.fieldModel = null;
          subFormData[this.subFormRowIndex][this.field.options.name] = null;
        } else {
          this.fieldModel = subFormData[this.subFormRowIndex][this.field.options.name];
        }

        /* 主动触发子表单内field-widget的onChange事件！！ */
        setTimeout(() => {
          //延时触发onChange事件, 便于更新计算字段！！
          this.handleOnChangeForSubForm(
            this.fieldModel,
            this.oldFieldValue,
            [],
            subFormData,
            this.subFormRowId
          );
        }, 800);
        this.oldFieldValue = deepClone(this.fieldModel);

        this.initFileList(); //处理图片上传、文件上传字段

        return;
      }

      if (
        this.formModel[this.field.options.name] === undefined &&
        this.field.options.defaultValue !== undefined
      ) {
        this.fieldModel = this.field.options.defaultValue;
      } else if (this.formModel[this.field.options.name] === undefined) {
        //如果formModel为空对象，则初始化字段值为null!!
        this.formModel[this.field.options.name] = null;
      } else {
        this.fieldModel = this.formModel[this.field.options.name];
      }
      this.oldFieldValue = deepClone(this.fieldModel);
      this.initFileList(); //处理图片上传、文件上传字段
    },

    initFileList() {
      //初始化上传组件的已上传文件列表
      if (
        (this.field.type !== 'picture-upload' && this.field.type !== 'file-upload') ||
        this.designState === true
      ) {
        return;
      }

      if (!!this.fieldModel) {
        if (Array.isArray(this.fieldModel)) {
          this.fileList = deepClone(this.fieldModel);
        } else {
          this.fileList.splice(0, 0, deepClone(this.fieldModel));
        }
      }
    },

    initEventHandler() {
      this.on$('setFormData', newFormData => {
        //console.log('formModel of globalModel----------', this.globalModel.formModel)
        if (!this.subFormItemFlag) {
          this.setValue(newFormData[this.field.options.name]);
        }
      });

      this.on$('field-value-changed', values => {
        if (!!this.subFormItemFlag) {
          const subFormData = this.formModel[this.subFormName];
          this.handleOnChangeForSubForm(values[0], values[1], subFormData, this.subFormRowId);
        } else {
          this.handleOnChange(values[0], values[1]);
        }
      });

      /* 监听从数据集加载选项事件 */
      this.on$('loadOptionItemsFromDataSet', dsName => {
        this.loadOptionItemsFromDataSet(dsName);
      });

      this.on$('reloadOptionItems', widgetNames => {
        if (widgetNames.length === 0 || widgetNames.indexOf(this.field.options.name) > -1) {
          this.initOptionItems(true);
        }
      });
    },

    handleOnCreated() {
      if (!!this.designState) {
        //设计状态不触发事件
        return;
      }

      if (!!this.field.options.onCreated) {
        const customFunc = new Function(this.field.options.onCreated);
        customFunc.call(this);
      }
    },

    handleOnMounted() {
      if (!!this.designState) {
        //设计状态不触发事件
        return;
      }

      if (!!this.field.options.onMounted) {
        const mountFunc = new Function(this.field.options.onMounted);
        mountFunc.call(this);
      }
    },

    registerToRefList(oldRefName) {
      if (this.refList !== null && !!this.field.options.name) {
        if (this.subFormItemFlag && !this.designState) {
          //处理子表单元素（且非设计状态）
          if (!!oldRefName) {
            delete this.refList[oldRefName + '@row' + this.subFormRowId];
          }
          this.refList[this.field.options.name + '@row' + this.subFormRowId] = this;
        } else {
          if (!!oldRefName) {
            delete this.refList[oldRefName];
          }
          this.refList[this.field.options.name] = this;
        }
      }
    },

    unregisterFromRefList() {
      //销毁组件时注销组件ref
      if (this.refList !== null && !!this.field.options.name) {
        const oldRefName = this.field.options.name;
        if (this.subFormItemFlag && !this.designState) {
          //处理子表单元素（且非设计状态）
          delete this.refList[oldRefName + '@row' + this.subFormRowId];
        } else {
          delete this.refList[oldRefName];
        }
      }
    },
    clearOptionItems() {
      if (!!this.field.options.dsEnabled) {
        this.field.options.optionItems.splice(0, this.field.options.optionItems.length); // 清空原有选项
      }
    },

    async initOptionItems(keepSelected) {
      if (this.designState) {
        return;
      }
      if (this.loading) return;
      this.loading = true;
      if (['radio', 'checkbox', 'select', 'cascader', 'treeSelect'].includes(this.field.type)) {
        /* 首先处理数据源选项加载 */
        if (!!this.field.options.dsEnabled && this.field.options.http?.url) {
          try {
            const dsResult = await fmtHttpParams.call(this, this.field.options, {
              fieldCode: this.field.options.name
            });
            if (isArray(dsResult)) {
              this.loadOptions(dsResult);
            }
            if (isArray(dsResult.list)) {
              if (this.field.options.loadingPage) {
                this.pager.total = dsResult.total || 0;
                this.pager.totalPage = dsResult.totalPage || 0;
                this.loadOptions([...this.getOptionItems(), ...dsResult.list]);
              } else {
                this.loadOptions(dsResult.list);
              }
            }
          } catch (err) {
            console.error('err: ', err);
          }
        }

        /* 异步更新option-data之后globalOptionData不能获取到最新值，改用provide的getOptionData()方法 */
        const newOptionItems = this.getOptionData();
        if (!!newOptionItems && newOptionItems.hasOwnProperty(this.field.options.name)) {
          if (!!keepSelected) {
            this.reloadOptions(newOptionItems[this.field.options.name]);
          } else {
            this.loadOptions(newOptionItems[this.field.options.name]);
          }
        }
        this.loading = false;
      }
    },

    loadOptionItemsFromDataSet(dsName) {
      if (this.designState) {
        return;
      }

      if (
        this.field.type !== 'radio' &&
        this.field.type !== 'checkbox' &&
        this.field.type !== 'select' &&
        this.field.type !== 'cascader'
      ) {
        return;
      }

      if (
        !this.field.options.dsEnabled ||
        !this.field.options.dsName ||
        !this.field.options.dataSetName ||
        this.field.options.dsName !== dsName
      ) {
        return;
      }

      const dataCache = this.getDSResultCache();
      const dSetName = this.field.options.dataSetName;
      if (!!dataCache && !!dataCache[dsName] && !!dataCache[dsName][dSetName]) {
        this.field.options.optionItems.splice(0, this.field.options.optionItems.length); // 清空原有选项
        this.loadOptions(dataCache[dsName][dSetName]);
      }
    },

    refreshDefaultValue() {
      if (this.designState === true && this.field.options.defaultValue !== undefined) {
        this.fieldModel = this.field.options.defaultValue;
      }
    },

    clearFieldRules() {
      if (!this.field.formItemFlag) {
        return;
      }

      this.rules.splice(0, this.rules.length); //清空已有
    },

    buildFieldRules() {
      if (!this.field.formItemFlag || this.field.options.hidden) {
        return;
      }

      this.rules.splice(0, this.rules.length); //清空已有
      if (!!this.field.options.required) {
        this.rules.push({
          required: true,
          //trigger: ['blur', 'change'],
          trigger: [
            'blur'
          ] /* 去掉change事件触发校验，change事件触发时formModel数据尚未更新，导致radio/checkbox必填校验出错！！ */,
          message: this.field.options.requiredHint || this.i18nt('render.hint.fieldRequired')
        });
      }

      if (!!this.field.options.validation) {
        const vldName = this.field.options.validation;
        if (!!FormValidators[vldName]) {
          this.rules.push({
            validator: FormValidators[vldName],
            trigger: ['blur', 'change'],
            label: this.field.options.label,
            errorMsg: this.field.options.validationHint
          });
        } else {
          this.rules.push({
            validator: FormValidators['regExp'],
            trigger: ['blur', 'change'],
            regExp: vldName,
            label: this.field.options.label,
            errorMsg: this.field.options.validationHint
          });
        }
      }

      if (!!this.field.options.onValidate) {
        //let customFn = new Function('rule', 'value', 'callback', this.field.options.onValidate)
        const customFn = (rule, value) => {
          const tmpFunc = new Function('rule', 'value', this.field.options.onValidate);
          return tmpFunc.call(this, rule, value);
        };
        this.rules.push({
          validator: customFn,
          trigger: ['blur'],
          label: this.field.options.label
        });
      }
    },

    /**
     * 禁用字段值变动触发表单校验
     */
    disableChangeValidate() {
      if (!this.rules) {
        return;
      }

      this.rules.forEach(rule => {
        if (!!rule.trigger) {
          rule.trigger.splice(0, rule.trigger.length);
        }
      });
    },

    /**
     * 启用字段值变动触发表单校验
     */
    enableChangeValidate() {
      if (!this.rules) {
        return;
      }

      this.rules.forEach(rule => {
        if (!!rule.trigger) {
          rule.trigger.push('blur');
          rule.trigger.push('change');
        }
      });
    },

    disableOptionOfList(optionList, optionValue) {
      if (!!optionList && optionList.length > 0) {
        optionList.forEach(opt => {
          if (opt.value === optionValue) {
            opt.disabled = true;
          }
        });
      }
    },

    enableOptionOfList(optionList, optionValue) {
      if (!!optionList && optionList.length > 0) {
        optionList.forEach(opt => {
          if (opt.value === optionValue) {
            opt.disabled = false;
          }
        });
      }
    },

    //--------------------- 组件内部方法 end ------------------//

    //--------------------- 事件处理 begin ------------------//

    emitFieldDataChange(newValue, oldValue) {
      if (newValue) {
        newValue = newValue.target ? newValue.target.value : newValue;
      }

      this.emit$('field-value-changed', [newValue, oldValue]);

      /* 必须用dispatch向指定父组件派发消息！！ */
      this.dispatch('VFormRender', 'fieldChange', [
        this.field.options.name,
        newValue,
        oldValue,
        this.subFormName,
        this.subFormRowIndex
      ]);
    },

    syncUpdateFormModel(value) {
      if (!!this.designState) {
        return;
      }

      if (!!this.subFormItemFlag) {
        const subFormData = this.formModel[this.subFormName] || [{}];
        const subFormDataRow = subFormData[this.subFormRowIndex];
        if (!!subFormDataRow) {
          // 重置表单后subFormDataRow为undefined，应跳过！！
          subFormDataRow[this.field.options.name] = value;
        }
      } else {
        this.formModel[this.field.options.name] = value;
      }
    },

    handleChangeEvent(value) {
      if (value) {
        value = value.target ? value.target.value : value;
      }

      if (!!this.designState) {
        //设计状态不触发事件
        return;
      }

      this.syncUpdateFormModel(value);
      this.emitFieldDataChange(value, this.oldFieldValue);

      //number组件一般不会触发focus事件，故此处需要手工赋值oldFieldValue！！
      this.oldFieldValue = deepClone(value); /* oldFieldValue需要在initFieldModel()方法中赋初值!! */

      /* 主动触发表单的单个字段校验，用于清除字段可能存在的校验错误提示 */
      this.dispatch('VFormRender', 'fieldValidation', [this.getPropName()]);
    },

    handleFocusCustomEvent(event) {
      if (!!this.designState) {
        //设计状态不触发事件
        return;
      }

      this.oldFieldValue = deepClone(this.fieldModel); //保存修改change之前的值

      if (!!this.field.options.onFocus) {
        const customFn = new Function('event', this.field.options.onFocus);
        customFn.call(this, event);
      }
      if (this.field.options.loadingPage) {
        this.initPager();
        this.initOptionItems();
      }
    },

    handleBlurCustomEvent(event) {
      if (!!this.designState) {
        //设计状态不触发事件
        return;
      }

      if (!!this.field.options.onBlur) {
        const customFn = new Function('event', this.field.options.onBlur);
        customFn.call(this, event);
      }
    },

    handleInputCustomEvent(value) {
      if (value) {
        value = value.target ? value.target.value : value;
      }

      if (!!this.designState) {
        //设计状态不触发事件
        return;
      }

      this.syncUpdateFormModel(value);

      /* 主动触发表单的单个字段校验，用于清除字段可能存在的校验错误提示 */
      this.dispatch('VFormRender', 'fieldValidation', [this.getPropName()]);

      if (!!this.field.options.onInput) {
        const customFn = new Function('value', this.field.options.onInput);
        customFn.call(this, value);
      }
    },

    emitAppendButtonClick() {
      if (!!this.designState) {
        //设计状态不触发点击事件
        return;
      }

      if (!!this.field.options.onAppendButtonClick) {
        const customFn = new Function(this.field.options.onAppendButtonClick);
        customFn.call(this);
      } else {
        /* 必须调用mixins中的dispatch方法逐级向父组件发送消息！！ */
        this.dispatch('VFormRender', 'appendButtonClick', [this]);
      }
    },

    handleOnChange(val, oldVal, ops = []) {
      //自定义onChange事件
      if (!!this.designState) {
        //设计状态不触发事件
        return;
      }

      if (!!this.field.options.onChange) {
        const changeFn = new Function('value', 'oldValue', 'ops', this.field.options.onChange);
        changeFn.call(this, val, oldVal, ops[0]);
      }
    },

    handleOnChangeForSubForm(val, oldVal, ops = [], subFormData, rowId) {
      //子表单自定义onChange事件
      if (!!this.designState) {
        //设计状态不触发事件
        return;
      }

      if (!!this.field.options.onChange) {
        const changeFn = new Function(
          'value',
          'oldValue',
          'ops',
          'subFormData',
          'rowId',
          this.field.options.onChange
        );
        changeFn.call(this, val, oldVal, ops[0], subFormData, rowId);
      }
    },
    onClick() {
      if (!!this.designState) {
        //设计状态不触发点击事件
        return;
      }

      if (!!this.field.options.onClick) {
        const customFn = new Function(this.field.options.onClick);
        return customFn.call(this);
      } else {
        this.dispatch('VFormRender', 'buttonClick', [this]);
      }
    },

    handleButtonWidgetClick() {
      if (!!this.designState) {
        //设计状态不触发点击事件
        return;
      }

      if (!!this.field.options.onClick) {
        const customFn = new Function(this.field.options.onClick);
        return customFn.call(this);
      } else {
        this.dispatch('VFormRender', 'buttonClick', [this]);
      }
    },
    /**
     * 下拉框右边搜索按钮
     */
    handleClickIcon() {
      if (!!this.designState) {
        //设计状态不触发事件
        return;
      }
      if (this.handleDisabled()) {
        return;
      }
      if (!!this.field.options.onClickIcon) {
        const onClickIconFn = new Function(this.field.options.onClickIcon);
        onClickIconFn.call(this);
      }
    },

    // remoteQuery(keyword) {
    //   if (!!this.designState) {
    //     //设计状态不触发事件
    //     return;
    //   }

    //   if (!!this.field.options.onRemoteQuery) {
    //     const remoteFn = new Function('keyword', this.field.options.onRemoteQuery);
    //     remoteFn.call(this, keyword);
    //   }
    // },

    //--------------------- 事件处理 end ------------------//

    //--------------------- 以下为组件支持外部调用的API方法 begin ------------------//
    /* 提示：用户可自行扩充这些方法！！！ */

    getFormRef() {
      /* 获取VFrom引用，必须在VForm组件created之后方可调用 */
      return this.refList['v_form_ref'];
    },

    getWidgetRef(widgetName, showError) {
      const foundRef = this.refList[widgetName];
      if (!foundRef && !!showError) {
        this.$message.error(this.i18nt('render.hint.refNotFound') + widgetName);
      }
      return foundRef;
    },

    getFieldEditor() {
      //获取内置的el表单组件
      return this.$refs['fieldEditor'];
    },
    showFileList(list) {
      if (!isArray(list)) return [];
      const res = list.map((item, uid) => ({
        ...item,
        name: item.fileName,
        uid
      }));
      return res;
    },

    /*
      注意：VFormRender的setFormData方法不会触发子表单内field-widget的setValue方法，
      因为setFormData方法调用后，子表单内所有field-widget组件已被清空，接收不到setFormData事件！！
    */
    setValue(newValue, disableChangeEvent = false) {
      if (newValue) {
        newValue = newValue.target ? newValue.target.value : newValue;
      }
      if (eq(this.fieldModel, newValue)) return;

      /* if ((this.field.type === 'picture-upload') || (this.field.type === 'file-upload')) {
        this.fileList = newValue
      } else */ if (!!this.field.formItemFlag) {
        const oldValue = deepClone(this.fieldModel);
        if (this.field.type === 'file-upload') {
          newValue = this.showFileList(newValue || []);
          // TODO
        } else if (this.field.type === 'code-editor') {
          this.$refs.fieldEditor.setValue(newValue);
        }
        this.fieldModel = newValue;
        this.initFileList();

        this.syncUpdateFormModel(newValue);
        if (!disableChangeEvent) {
          this.emitFieldDataChange(newValue, oldValue);
        }
      }
    },

    getValue() {
      /* if ((this.field.type === 'picture-upload') || (this.field.type === 'file-upload')) {
        return this.fileList
      } else */ {
        return this.fieldModel;
      }
    },

    resetField() {
      const defaultValue = this.field.options.defaultValue;
      this.setValue(defaultValue);
      this.$nextTick(() => {
        //
      });

      //清空上传组件文件列表
      if (this.field.type === 'picture-upload' || this.field.type === 'file-upload') {
        this.fileList.splice(0, this.fileList.length);
        this.handleChangeEvent(this.fileList);
      }
    },

    setWidgetOption(optionName, optionValue) {
      //通用组件选项修改API
      if (this.field.options.hasOwnProperty(optionName)) {
        this.field.options[optionName] = optionValue;
        //TODO: 是否重新构建组件？？有些属性修改后必须重新构建组件才能生效，比如字段校验规则。
      }
    },

    setReadonly(flag) {
      this.field.options.readonly = flag;
    },

    setDisabled(flag) {
      this.field.options.disabled = flag;
    },

    setAppendButtonVisible(flag) {
      this.field.options.appendButton = flag;
    },

    setAppendButtonDisabled(flag) {
      this.field.options.appendButtonDisabled = flag;
    },

    setHidden(flag) {
      this.field.options.hidden = flag;

      if (!!flag) {
        //清除组件校验规则
        this.clearFieldRules();
      } else {
        //重建组件校验规则
        this.buildFieldRules();
      }
    },

    setRequired(flag) {
      this.field.options.required = flag;
      this.buildFieldRules();

      if (!this.designState && !flag) {
        //清除必填校验提示
        this.clearValidate();
      }
    },

    /**
     * 清除字段校验提示
     */
    clearValidate() {
      if (!!this.designState) {
        return;
      }

      this.getFormRef().getNativeForm().clearValidate(this.getPropName());
    },
    getVfCtx() {
      return this.getFormRef().vfCtx;
    },

    setLabel(newLabel) {
      this.field.options.label = newLabel;
    },

    focus() {
      if (!!this.getFieldEditor() && !!this.getFieldEditor().focus) {
        this.getFieldEditor().focus();
      }
    },

    clearSelectedOptions() {
      //清空已选选项
      if (
        this.field.type !== 'checkbox' &&
        this.field.type !== 'radio' &&
        this.field.type !== 'select'
      ) {
        return;
      }

      if (
        this.field.type === 'checkbox' ||
        (this.field.type === 'select' && this.field.options.multiple)
      ) {
        this.fieldModel = [];
      } else {
        this.fieldModel = '';
      }
    },

    /**
     * 加载选项，并清空字段值
     * @param options
     */
    loadOptions(options) {
      /*
      this.field.options.optionItems = deepClone(options)
      //this.clearSelectedOptions()  //清空已选选项
       */

      this.field.options.optionItems = translateOptionItems(
        options,
        this.field.type,
        this.field.options.labelKey || 'label',
        this.field.options.valueKey || 'value'
      );
    },

    /**
     * 重新加载选项，不清空字段值
     * @param options
     */
    reloadOptions(options) {
      //this.field.options.optionItems = deepClone(options)

      this.field.options.optionItems = translateOptionItems(
        options,
        this.field.type,
        this.field.options.labelKey || 'label',
        this.field.options.valueKey || 'value'
      );
    },

    disableOption(optionValue) {
      this.disableOptionOfList(this.field.options.optionItems, optionValue);
    },

    enableOption(optionValue) {
      this.enableOptionOfList(this.field.options.optionItems, optionValue);
    },

    /**
     * 返回选择项
     * @returns {*}
     */
    getOptionItems() {
      return this.field.options.optionItems;
    },

    setUploadHeader(name, value) {
      this.uploadHeaders[name] = value;
    },

    setUploadData(name, value) {
      this.uploadData[name] = value;
    },

    setToolbar(customToolbar) {
      this.customToolbar = customToolbar;
    },

    /**
     * 是否子表单内嵌的字段组件
     * @returns {boolean}
     */
    isSubFormItem() {
      return this.subFormItemFlag;
    },

    /**
     * 是否子表单内嵌的字段组件
     * @returns {boolean}
     */
    isSubFormField() {
      return this.subFormItemFlag;
    },

    /**
     * 设置或取消设置字段只读查看模式
     * @param readonlyFlag
     */
    setReadMode(readonlyFlag = true) {
      this.fieldReadonlyFlag = readonlyFlag;
    },

    /**
     * 动态增加自定义css样式
     * @param className
     */
    addCssClass(className) {
      if (!this.field.options.customClass) {
        this.field.options.customClass = [className];
      } else {
        this.field.options.customClass.push(className);
      }
    },

    /**
     * 动态移除自定义css样式
     * @param className
     */
    removeCssClass(className) {
      if (!this.field.options.customClass) {
        return;
      }

      let foundIdx = -1;
      this.field.options.customClass.map((cc, idx) => {
        if (cc === className) {
          foundIdx = idx;
        }
      });
      if (foundIdx > -1) {
        this.field.options.customClass.splice(foundIdx, 1);
      }
    }

    //--------------------- 以上为组件支持外部调用的API方法 end ------------------//
  }
};
