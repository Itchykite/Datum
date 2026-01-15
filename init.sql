-- Użycie docelowej bazy danych
USE warehouse_db;

-- Tabela Dostawców
CREATE TABLE suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela Produktów
CREATE TABLE products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    supplier_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
);

-- Tabela Lokalizacji w magazynie (np. regał, półka, strefa)
CREATE TABLE locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    location_code VARCHAR(20) NOT NULL UNIQUE,
    description VARCHAR(255),
    capacity INT DEFAULT 100
);

-- Tabela Stanu Magazynowego (Inventory)
CREATE TABLE inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    location_id INT NOT NULL,
    quantity INT NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id),
    UNIQUE KEY (product_id, location_id)
);

-- Tabela Klientów
CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela Zamówień
CREATE TABLE orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- Tabela Pozycji Zamówienia
CREATE TABLE order_items (
    order_item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price_per_unit DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Wypełnienie danymi

-- Dostawcy
INSERT INTO suppliers (supplier_name, contact_person, phone, email) VALUES
('Elektronika S.A.', 'Adam Nowak', '123-456-789', 'kontakt@elektronikasa.pl'),
('NarzędziaMax', 'Ewa Kowalska', '987-654-321', 'ewa@narzedziamax.com'),
('Meblopol', 'Jan Wiśniewski', '555-444-333', 'biuro@meblopol.pl');

-- Produkty
INSERT INTO products (sku, product_name, description, price, supplier_id) VALUES
('EL-TV-001', 'Telewizor LED 55"', 'Nowoczesny telewizor 4K UHD', 2499.99, 1),
('EL-LAP-002', 'Laptop 15.6" i5', 'Wydajny laptop biurowy', 3200.50, 1),
('NAR-KLUCZ-01', 'Zestaw kluczy nasadowych', '108 elementów, stal chromowo-wanadowa', 299.00, 2),
('NAR-WIERT-02', 'Wiertarka udarowa 850W', 'Mocna wiertarka do prac domowych', 450.00, 2),
('MEB-STOL-01', 'Stół dębowy 180x90', 'Solidny stół do jadalni', 1800.00, 3),
('MEB-KRZES-02', 'Krzesło tapicerowane szare', 'Wygodne krzesło do stołu', 250.75, 3),
('EL-SMART-003', 'Smartfon 6.5"', 'Telefon z potrójnym aparatem', 1500.00, 1);

-- Lokalizacje w magazynie
INSERT INTO locations (location_code, description, capacity) VALUES
('A-01-01', 'Strefa A, Regał 1, Półka 1', 50),
('A-01-02', 'Strefa A, Regał 1, Półka 2', 50),
('B-01-01', 'Strefa B, Regał 1, Półka 1 (Duże gabaryty)', 20),
('C-01-01', 'Strefa C (narzędzia), Regał 1, Półka 1', 100);

-- Stan magazynowy
INSERT INTO inventory (product_id, location_id, quantity) VALUES
(1, 2, 10), -- 10 telewizorów na A-01-02
(2, 1, 25), -- 25 laptopów na A-01-01
(3, 4, 40), -- 40 zestawów kluczy na C-01-01
(4, 4, 30), -- 30 wiertarek na C-01-01
(5, 3, 8),  -- 8 stołów na B-01-01
(6, 3, 32), -- 32 krzesła na B-01-01
(7, 1, 50); -- 50 smartfonów na A-01-01

-- Klienci
INSERT INTO customers (first_name, last_name, email, phone, address) VALUES
('Katarzyna', 'Zielińska', 'k.zielinska@example.com', '111-222-333', 'ul. Słoneczna 10, 00-123 Warszawa'),
('Piotr', 'Wójcik', 'piotr.wojcik@email.net', '444-555-666', 'ul. Leśna 5, 30-002 Kraków'),
('Anna', 'Lis', 'ania.lis@poczta.pl', '777-888-999', 'ul. Morska 22, 80-341 Gdańsk');

-- Zamówienia
INSERT INTO orders (customer_id, status) VALUES
(1, 'shipped'),
(2, 'processing'),
(1, 'delivered'),
(3, 'pending');

-- Pozycje zamówień
-- Zamówienie 1
INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES
(1, 1, 1, 2499.99), -- 1 telewizor
(1, 7, 2, 1500.00); -- 2 smartfony
-- Zamówienie 2
INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES
(2, 3, 1, 299.00), -- 1 zestaw kluczy
(2, 4, 1, 450.00); -- 1 wiertarka
-- Zamówienie 3
INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES
(3, 5, 1, 1800.00), -- 1 stół
(3, 6, 4, 250.75); -- 4 krzesła
-- Zamówienie 4
INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES
(4, 2, 1, 3200.50); -- 1 laptop
