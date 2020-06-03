import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

interface IProductToOrder {
  product_id: string;
  price: number;
  quantity: number;
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Cannot found the customer');
    }

    const foundProducts = await this.productsRepository.findAllById(
      products.map(productFind => ({ id: productFind.id })),
    );

    const productsToOrder: IProductToOrder[] = [];

    const productsToUpdateStock = products.map(product => {
      const foundProduct = foundProducts.find(
        orderProduct => orderProduct.id === product.id,
      );

      if (!foundProduct) {
        throw new AppError('Cannot find product');
      }

      if (foundProduct.quantity - product.quantity < 0) {
        throw new AppError(
          'You cannot do an order with quantity bigger than stock',
        );
      }

      const productToOrder = {
        product_id: product.id,
        price: foundProduct.price,
        quantity: product.quantity,
      };

      productsToOrder.push(productToOrder);

      return {
        id: product.id,
        quantity: foundProduct.quantity - product.quantity,
      };
    });

    await this.productsRepository.updateQuantity(productsToUpdateStock);

    const order = this.ordersRepository.create({
      customer,
      products: productsToOrder,
    });

    return order;
  }
}

export default CreateOrderService;
