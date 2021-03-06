import _ from 'lodash';
import React from 'react';
import {SafeAreaView, Dimensions, ScrollView, View, Text, Image, TouchableOpacity, Alert} from 'react-native';

import {AppNavigationProps} from '../../../app-navigation-props';
import {ComponentViewState} from '../../../component.state';
import {appStyles} from '../../../app.style-impl';
import {Orientation} from '../../../models/device-orientation';
import {styles} from './qrcode.style-impl';
import {QRCodeScreenState} from './qrcode.screen.state';
import {Cart, Button} from '../../../components';
import {CheckoutCart, Transaction} from '../../../models';
import {PaymentStatus} from '../../../shared';
import QRCode from 'react-native-qrcode-svg';
import * as Progress from 'react-native-progress';
import Config from 'react-native-config';

export class QRCodeScreen extends React.Component<AppNavigationProps, QRCodeScreenState> {

  static readonly interval = Number(Config.PAYMENT_STATUS_POLLING_INTERVAL);

  constructor(props: AppNavigationProps) {
    super(props);
    this.state = {
      loadingLogo: false,
      storeLogo: '',
      orientation: Orientation.UNKNOWN,
      componentState: ComponentViewState.DEFAULT,
    };
    this.pollTransactionStatus = this.pollTransactionStatus.bind(this);
    this.transactionComplete = this.transactionComplete.bind(this);
    this.onLogoLoadStartFromSource = this.onLogoLoadStartFromSource.bind(this);
    this.onLogoLoadEndFromSource = this.onLogoLoadEndFromSource.bind(this);
    this.refresh = this.refresh.bind(this);
  }

  getOrientation = () => {
    if (Dimensions.get('window').width < Dimensions.get('window').height) {
      this.setState({
        orientation: Orientation.POTRAIT,
      });
    } else {
      this.setState({
        orientation: Orientation.LANDSCAPE,
      });
    }
  }

  componentWillMount() {
    this.getOrientation();
    Dimensions.addEventListener('change', this.getOrientation);
  }

  componentWillUnmount() {
    this.getOrientation();
    Dimensions.removeEventListener('change', this.getOrientation);
  }

  translate(key: string) {
    return this.props.screenProps.translate(key, null);
  }

  getStoreService() {
    return this.props.screenProps.storeService;
  }

  getContainerStyle() {
    if (this.state.orientation === Orientation.POTRAIT) {
      return styles.containerPotrait;
    }
  }

  getPaymentModeContainerStyle() {
    if (this.state.orientation === Orientation.POTRAIT) {
      return styles.qrcodeContainerPotrait;
    }
  }

  getPaymentModeSectionStyle() {
    if (this.state.orientation === Orientation.POTRAIT) {
      return styles.qrcodeSectionPotrait;
    }
  }

  getBillingSectionStyle() {
    if (this.state.orientation === Orientation.POTRAIT) {
      return styles.billingSectionPotrait;
    }
  }

  getTransactionService() {
    return this.props.screenProps.transactionService;
  }

  async refresh() {
    const {navigation: {getParam}} = this.props;
    const storeId = getParam('store_id');
    const merchantId = getParam('merchant_id');
    const storeService = this.getStoreService();
    const response = await storeService.getStore(storeId, merchantId);
    if (response.hasData()
    && response.data) {
      if (response.data.image) {
        this.setState({
          storeLogo: response.data.image,
        });
      }
    }
  }

  onLogoLoadStartFromSource() {
    this.setState({
      loadingLogo: true,
    });
  }

  onLogoLoadEndFromSource() {
    this.setState({
      loadingLogo: false,
    });
  }

  pollTransactionStatus() {
    const {navigation: {getParam}} = this.props;
    const transactionService = this.getTransactionService();
    const transaction_id = getParam('transaction_id');
    const checkStatus = (async (resolve, reject) => {
      const response = await transactionService.getDetails(transaction_id);
      if (response.hasData() &&
        response.data) {
        const transaction: Transaction = response.data;
        if (transaction.paymentStatus === PaymentStatus.PENDING_PAYMENT) {
          setTimeout(checkStatus, QRCodeScreen.interval, resolve, reject);
        } else if (transaction.paymentStatus === PaymentStatus.PROCESSING) {
          this.setState({
            componentState: ComponentViewState.LOADING,
          });
          setTimeout(checkStatus, QRCodeScreen.interval, resolve, reject);
        } else if (transaction.paymentStatus === PaymentStatus.PAID) {
          this.setState({
            componentState: ComponentViewState.LOADED,
          });
          resolve();
        }
      }
    });
    return new Promise(checkStatus);
  }

  componentDidMount() {
    this.refresh();
    this.pollTransactionStatus();
  }

  transactionComplete() {
    const {navigation: {pop, push, getParam}} = this.props;
    const storeId = getParam('store_id');
    const merchantId = getParam('merchant_id');
    /*
    navigation stack from top has 1. qrcode screen 2. payment mode screen
    3. pos screen
    so now transaction is done and we need to navigate to pos screen
    */
    pop(3);
    push('POS', {store_id: storeId, merchant_id: merchantId});
  }

  render() {
    const {navigation: {getParam, goBack}, screenProps: {translate}} = this.props;
    const {componentState, storeLogo, loadingLogo} = this.state;
    const isComponentLoading = componentState === ComponentViewState.LOADING;
    const isComponentLoaded = componentState === ComponentViewState.LOADED;
    const storeId = getParam('store_id');
    const merchantId = getParam('merchant_id');
    const checkoutCart: CheckoutCart = getParam('checkoutCart');
    const transaction_id = getParam('transaction_id');
    const isStoreLogo = !_.isEmpty(storeLogo);

    return (
      <SafeAreaView style={appStyles.safeAreaView}>
        <ScrollView>
          <View style={styles.rootView}>
            <View style={styles.header}>
              <Image source={require('../../../../assets/images/logo/logo.png')}/>
              <View style={styles.storeLogoContainer}>
              {
                !isStoreLogo && (
                  <Image source={require('../../../../assets/images/icons/merchant_logo.png')}/>
                )
              }
              {
                isStoreLogo && loadingLogo && (
                  <View style={styles.progressBar}>
                    <Progress.Bar indeterminate={true} width={100}/>
                  </View>
                )
              }
              {
                isStoreLogo && (
                  <TouchableOpacity>
                    <Image style={styles.storeLogo} onLoadStart={this.onLogoLoadStartFromSource}
                    onLoad={this.onLogoLoadEndFromSource}
                    source={{uri: storeLogo}}/>
                  </TouchableOpacity>
                )
              }
              </View>
            </View>
            <View style={[styles.container, this.getContainerStyle()]}>
              <View style={[styles.qrcodeSection, this.getPaymentModeSectionStyle()]}>
                <View style={[styles.qrcodeContainer, this.getPaymentModeContainerStyle()]}>
                  {
                    !isComponentLoaded && (
                      <View style={{justifyContent: 'center', alignItems: 'center'}}>
                        <TouchableOpacity style={styles.qrcode}>
                          <QRCode
                            value={transaction_id}
                            color={'#2C8DDB'}
                            size={265}
                            logo={require('../../../../assets/images/logo/kadima_round_logo.png')}
                            logoSize={40}
                          />
                        </TouchableOpacity>
                        <View style={{marginTop: 10}}>
                          {
                            isComponentLoading && (
                              <Progress.Pie
                                borderColor={'#2C8DDB'} color={'#DA6624'} borderWidth={5} size={100} indeterminate={true} />
                            )
                          }
                        </View>
                      </View>
                    )
                  }
                  {
                    isComponentLoaded && (
                      <View style={{justifyContent: 'center', alignItems: 'center'}}>
                        <View style={styles.transactionComplete}>
                          <Text style={styles.transactionCompleteText}>{translate('QRCODE_SCREEN.TRANSACTION_COMPLETE')}</Text>
                        </View>
                        <View style={{marginTop: 10}}>
                          <Button
                            text={translate('QRCODE_SCREEN.DONE')}
                            type={'btn-primary'}
                            onPress={this.transactionComplete}
                          />
                        </View>
                      </View>
                    )
                  }
                </View>
                <TouchableOpacity onPress={() => goBack()} style={styles.backButton}>
                  <Image source={require('../../../../assets/images/icons/back_icon.png')} />
                </TouchableOpacity>
              </View>
              <View style={[styles.billingSection, this.getBillingSectionStyle()]}>
                  <View>
                    <Cart
                      merchantId={merchantId}
                      storeId={storeId}
                      cart={checkoutCart}
                      storeService={this.getStoreService()}
                      translate={translate}
                    />
                  </View>
                  <View style={[styles.payButtonContainer]}>
                    <Button
                      text={translate('QRCODE_SCREEN.PAY')}
                      disabled={true}
                      type={'btn-primary'}
                    />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
}
