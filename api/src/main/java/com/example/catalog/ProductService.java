package com.example.catalog;

import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

/** Serves mock data. Swap this for a repository when a real database is added. */
@Service
public class ProductService {

    private final List<Product> products = List.of(
            new Product(1, "Trail Backpack 28L", "Outdoor", 8900, 42),
            new Product(2, "Insulated Bottle 750ml", "Outdoor", 2900, 120),
            new Product(3, "Merino Hiking Socks", "Apparel", 1800, 75),
            new Product(4, "Headlamp 400 lumens", "Outdoor", 3500, 0),
            new Product(5, "Packable Rain Shell", "Apparel", 12900, 18));

    public List<Product> findAll() {
        return products;
    }

    public Optional<Product> findById(int id) {
        return products.stream().filter(p -> p.id() == id).findFirst();
    }
}
